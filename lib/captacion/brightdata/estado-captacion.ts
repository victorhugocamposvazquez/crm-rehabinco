import { configBrightDataIdealista } from "@/lib/captacion/brightdata/config";
import { lockProcesarActivo } from "@/lib/captacion/brightdata/procesar-lock";
import {
  estimarMinutosVaciarCola,
  paginasPorMinutoRafaga,
  textoEstimacionCola,
} from "@/lib/captacion/brightdata/rafaga-config";
import { ultimaRafaga, type RafagaCaptacion } from "@/lib/captacion/brightdata/rafagas";
import {
  resumenPresupuestoUnlocker,
  textoPresupuestoUnlocker,
  type ResumenPresupuestoUnlocker,
} from "@/lib/captacion/brightdata/presupuesto-unlocker";
import { leerGastoBrightData } from "@/lib/captacion/brightdata/saldo";
import { hayRecogidaAbiertaReciente } from "@/lib/captacion/brightdata/recogidas";
import { metricasTelefonos, telefonosColaPausada } from "@/lib/captacion/brightdata/telefonos-metricas";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoCheckCaptacion = {
  id: string;
  label: string;
  nivel: "ok" | "aviso" | "error";
  detalle: string;
};

export type EstadoCaptacion = {
  nivel: "ok" | "aviso" | "error";
  checks: EstadoCheckCaptacion[];
  ultimaRafaga: RafagaCaptacion | null;
  rafagaEnCurso: boolean;
  recogidaAbiertaReciente: boolean;
  paginasPendientes: number;
  paginasPorMinutoUltimaRafaga: number | null;
  estimacionVaciarCola: string | null;
  gasto: { saldo: number | null; pendiente: number | null; aviso: string | null; mes: string | null };
  presupuestoUnlocker: ResumenPresupuestoUnlocker;
};

const MS_CRON_PROCESAR = 12 * 60 * 1000;
const MS_LISTADO_DIARIO = 28 * 60 * 60 * 1000;
const SALDO_MINIMO_USD = 5;

function nivelGlobal(checks: EstadoCheckCaptacion[]): "ok" | "aviso" | "error" {
  if (checks.some((c) => c.nivel === "error")) return "error";
  if (checks.some((c) => c.nivel === "aviso")) return "aviso";
  return "ok";
}

export async function evaluarEstadoCaptacion(): Promise<EstadoCaptacion> {
  const supabase = createAdminClient();
  const checks: EstadoCheckCaptacion[] = [];
  const config = configBrightDataIdealista();
  if ("error" in config) {
    checks.push({ id: "unlocker", label: "Unlocker (Vercel)", nivel: "error", detalle: config.error });
  } else {
    checks.push({ id: "unlocker", label: "Unlocker (Vercel)", nivel: "ok", detalle: `Zona ${config.zone}.` });
  }

  let gasto: EstadoCaptacion["gasto"] = { saldo: null, pendiente: null, aviso: null, mes: null };
  if (!("error" in config)) {
    const g = await leerGastoBrightData(config.token);
    gasto = { saldo: g.saldo, pendiente: g.pendiente, aviso: g.aviso, mes: g.mes };
    if (g.aviso) {
      checks.push({ id: "saldo", label: "Saldo Bright Data", nivel: "error", detalle: g.aviso });
    } else if (g.saldo != null && g.saldo < SALDO_MINIMO_USD) {
      checks.push({
        id: "saldo",
        label: "Saldo Bright Data",
        nivel: "aviso",
        detalle: `Saldo bajo (${g.saldo.toFixed(2)} USD). Recarga pronto.`,
      });
    } else {
      checks.push({
        id: "saldo",
        label: "Saldo Bright Data",
        nivel: "ok",
        detalle: g.saldo != null ? `${g.saldo.toFixed(2)} USD disponibles.` : "Cuenta accesible.",
      });
    }
  }

  const rafagaEnCurso = await lockProcesarActivo();
  const ultima = await ultimaRafaga();
  const ahora = Date.now();
  const refRafaga = ultima?.terminada_en ?? ultima?.iniciada_en;
  const haceRafaga = refRafaga ? ahora - new Date(refRafaga).getTime() : Infinity;

  const { count: pendientes } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  const nPend = pendientes ?? 0;

  if (rafagaEnCurso) {
    checks.push({ id: "cron_procesar", label: "Cron procesar (cada 5 min)", nivel: "ok", detalle: "Ráfaga en curso ahora." });
  } else if (ultima?.motivo === "lock_ocupado" && haceRafaga < MS_CRON_PROCESAR) {
    checks.push({
      id: "cron_procesar",
      label: "Cron procesar (cada 5 min)",
      nivel: "ok",
      detalle: "El cron responde; la ráfaga anterior aún ocupaba el lock.",
    });
  } else if (haceRafaga <= MS_CRON_PROCESAR) {
    const det =
      ultima?.motivo && ultima.motivo !== "lock_ocupado"
        ? `Última ráfaga: ${ultima.motivo}.`
        : `Última ráfaga hace ${Math.round(haceRafaga / 60000)} min (${ultima?.paginas ?? 0} págs).`;
    checks.push({
      id: "cron_procesar",
      label: "Cron procesar (cada 5 min)",
      nivel: ultima?.ok === false ? "aviso" : "ok",
      detalle: det,
    });
  } else if (nPend === 0) {
    checks.push({
      id: "cron_procesar",
      label: "Cron procesar (cada 5 min)",
      nivel: "ok",
      detalle: "Sin cola pendiente; no hace falta ráfaga reciente.",
    });
  } else {
    checks.push({
      id: "cron_procesar",
      label: "Cron procesar (cada 5 min)",
      nivel: "error",
      detalle: `Sin ráfaga en ${Math.round(haceRafaga / 60000)} min y ${nPend} páginas en cola. Revisa pg_cron / migración.`,
    });
  }

  const { data: ultRecogida } = await supabase
    .from("captacion_recogidas")
    .select("iniciada")
    .order("iniciada", { ascending: false })
    .limit(1)
    .maybeSingle();
  const haceListado = ultRecogida?.iniciada ? ahora - new Date(ultRecogida.iniciada as string).getTime() : Infinity;
  if (haceListado <= MS_LISTADO_DIARIO) {
    checks.push({
      id: "cron_listado",
      label: "Listado diario (pg_cron)",
      nivel: "ok",
      detalle: `Última recogida ${new Date(ultRecogida!.iniciada as string).toLocaleString("es-ES")}.`,
    });
  } else {
    checks.push({
      id: "cron_listado",
      label: "Listado diario (pg_cron)",
      nivel: "aviso",
      detalle: ultRecogida?.iniciada
        ? `Sin recogida nueva desde ${new Date(ultRecogida.iniciada as string).toLocaleDateString("es-ES")}.`
        : "Aún no hay recogidas registradas.",
    });
  }

  if (await telefonosColaPausada()) {
    const { data: telCfg } = await supabase.from("captacion_telefono_config").select("pausado_en").eq("id", 1).maybeSingle();
    const tel = await metricasTelefonos();
    const pct =
      tel.hoy.tasa != null ? `${Math.round(tel.hoy.tasa * 100)} %` : "—";
    const cuenta = `${tel.hoy.obtenidos} ok · ${tel.hoy.fallidos} fallo(s) hoy (${pct})`;
    checks.push({
      id: "telefonos",
      label: "Cola de teléfonos",
      nivel: "aviso",
      detalle: telCfg?.pausado_en
        ? `Pausada desde ${new Date(telCfg.pausado_en as string).toLocaleString("es-ES")} · ${cuenta}. Tras 5 intentos, si ok/(ok+fallos) < 60 % se pausa (cuerpo vacío ya no cuenta como fallo).`
        : `Pausada · ${cuenta}.`,
    });
  } else {
    checks.push({ id: "telefonos", label: "Cola de teléfonos", nivel: "ok", detalle: "Activa." });
  }

  if (!process.env.CRON_SECRET?.trim()) {
    checks.push({ id: "cron_secret", label: "CRON_SECRET", nivel: "error", detalle: "No configurado en Vercel." });
  } else {
    checks.push({ id: "cron_secret", label: "CRON_SECRET", nivel: "ok", detalle: "Presente en el entorno." });
  }

  const presupuestoUnlocker = await resumenPresupuestoUnlocker();
  const pctMes = presupuestoUnlocker.usadasMes / presupuestoUnlocker.topeMes;
  if (presupuestoUnlocker.restantesMes <= 0) {
    checks.push({
      id: "presupuesto_unlocker",
      label: "Presupuesto Unlocker",
      nivel: "error",
      detalle: `${textoPresupuestoUnlocker(presupuestoUnlocker)} Ráfagas pausadas hasta el próximo mes (UTC).`,
    });
  } else if (presupuestoUnlocker.restantesDia <= 0) {
    checks.push({
      id: "presupuesto_unlocker",
      label: "Presupuesto Unlocker",
      nivel: "aviso",
      detalle: `${textoPresupuestoUnlocker(presupuestoUnlocker)} Tope diario alcanzado; mañana (UTC) sigue el reparto.`,
    });
  } else if (pctMes >= 0.9) {
    checks.push({
      id: "presupuesto_unlocker",
      label: "Presupuesto Unlocker",
      nivel: "aviso",
      detalle: textoPresupuestoUnlocker(presupuestoUnlocker),
    });
  } else {
    checks.push({
      id: "presupuesto_unlocker",
      label: "Presupuesto Unlocker",
      nivel: "ok",
      detalle: textoPresupuestoUnlocker(presupuestoUnlocker),
    });
  }

  const ppm =
    ultima && ultima.motivo !== "lock_ocupado"
      ? paginasPorMinutoRafaga(ultima.paginas, ultima.duracion_ms)
      : null;
  const estimacionVaciarCola = textoEstimacionCola(estimarMinutosVaciarCola(nPend, ppm));

  return {
    nivel: nivelGlobal(checks),
    checks,
    ultimaRafaga: ultima,
    rafagaEnCurso,
    recogidaAbiertaReciente: await hayRecogidaAbiertaReciente(),
    paginasPendientes: nPend,
    paginasPorMinutoUltimaRafaga: ppm,
    estimacionVaciarCola,
    gasto,
    presupuestoUnlocker,
  };
}
