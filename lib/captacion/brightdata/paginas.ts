import { aplicarFicha, marcarFichaPendiente, urlConfigDetalleIdealista } from "@/lib/captacion/brightdata/fichas";
import {
  RAFAGA_ESPERA_TELEFONO_MS,
  RAFAGA_MAX_PAGINAS,
  RAFAGA_PARALELO_UNLOCKER,
  RAFAGA_TELEFONO_MAX,
  RAFAGA_TOPE_MS,
  rafagaDebeParar,
} from "@/lib/captacion/brightdata/rafaga-config";
import {
  aplicarSoloMensaje,
  aplicarTelefono,
  encolarTelefono,
  externoIdDeUrlTelefono,
  marcarTelefonoPendiente,
} from "@/lib/captacion/brightdata/telefonos";
import { registrarPedidoTelefono, registrarResultadoTelefono, telefonosColaPausada } from "@/lib/captacion/brightdata/telefonos-metricas";
import { ingestarIdealistaBrightData } from "@/lib/captacion/brightdata/ingestar";
import { parsearListadoIdealista } from "@/lib/captacion/brightdata/parse-listado";
import { acumularMetricas, metricasRafagaVacias, type MetricasRafaga } from "@/lib/captacion/brightdata/metricas-rafaga";
import {
  anotarYSumarVistos,
  intentarCerrarRecogidasAbiertas,
  marcarSospechosaTransporte,
} from "@/lib/captacion/brightdata/recogidas";
import {
  esErrorTransporteUnlocker,
  MAX_INTENTOS_TRANSPORTE_LISTADO,
  motivoTransporteUnlocker,
} from "@/lib/captacion/brightdata/unlocker-transporte";
import type { RespuestaUnlocker } from "@/lib/captacion/brightdata/unlocker";
import { guardarDiagnosticoUnlocker } from "@/lib/captacion/brightdata/unlocker-diagnostico";
import {
  esRespuestaTelefonoUnlockerValida,
  esSoloMensajeTelefonoUnlocker,
} from "@/lib/captacion/brightdata/unlocker-telefono";
import { configUnlocker, pedirHtmlUnlocker, pedirUnlocker } from "@/lib/captacion/brightdata/unlocker";
import { ZONA_PROVINCIA_48H } from "@/lib/captacion/brightdata/zonas";
import { createAdminClient } from "@/lib/supabase/admin";

const TOPE = 60;

type Pagina = {
  id: string;
  recogida_id: string | null;
  url: string;
  zona_id: string;
  page: number;
  tipo?: string | null;
  intentos?: number | null;
};

type ConfigUnlocker = { zone: string; token: string };

type ResultadoPagina = { errores: number; metricas: Partial<MetricasRafaga> };

export type OpcionesProcesarPaginas = {
  limitePaginas?: number;
  paralelo?: number;
  topeMs?: number;
  /** Para tests: reloj monotónico en ms. */
  ahora?: () => number;
};

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function manejarTransporteListado(
  supabase: ReturnType<typeof createAdminClient>,
  pagina: Pagina,
  config: ConfigUnlocker,
  resp: RespuestaUnlocker
): Promise<void> {
  await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
  const intentos = pagina.intentos ?? 0;
  const siguiente = intentos + 1;
  const motivo = motivoTransporteUnlocker(resp);
  if (siguiente >= MAX_INTENTOS_TRANSPORTE_LISTADO && pagina.recogida_id && pagina.zona_id !== ZONA_PROVINCIA_48H) {
    await supabase.from("captacion_paginas_pendientes").update({ estado: "error", intentos: siguiente }).eq("id", pagina.id);
    await marcarSospechosaTransporte(pagina.recogida_id, pagina.zona_id, motivo);
    return;
  }
  await supabase.from("captacion_paginas_pendientes").update({ estado: "pendiente", intentos: siguiente }).eq("id", pagina.id);
}

function externoIdFicha(url: string): string {
  return (url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "";
}

async function procesarFichaPagina(
  supabase: ReturnType<typeof createAdminClient>,
  config: ConfigUnlocker,
  pagina: Pagina
): Promise<ResultadoPagina> {
  const externoId = externoIdFicha(pagina.url);
  const metricas: Partial<MetricasRafaga> = {};
  try {
    const tDescarga = Date.now();
    const configUrl = externoId ? urlConfigDetalleIdealista(externoId) : null;
    const [html, cfg] = await Promise.all([
      pedirHtmlUnlocker(config, pagina.url),
      configUrl
        ? pedirUnlocker(config, configUrl)
            .then((r) => (r.ok ? r.cuerpo : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    metricas.ms_descarga = Date.now() - tDescarga;
    const tParse = Date.now();
    const resultado = await aplicarFicha(html, pagina.url, { configJson: cfg });
    metricas.ms_parseo = Date.now() - tParse;
    await supabase
      .from("captacion_paginas_pendientes")
      .update({ estado: resultado === "ok" ? "hecha" : "pendiente" })
      .eq("id", pagina.id);
    if (resultado === "ok") {
      if (externoId) await encolarTelefono(externoId).catch(() => undefined);
    }
    if (resultado !== "ok") await marcarFichaPendiente(externoId);
    return { errores: 0, metricas };
  } catch {
    await marcarFichaPendiente(externoId);
    return { errores: 1, metricas };
  }
}

async function procesarListadoPagina(
  supabase: ReturnType<typeof createAdminClient>,
  config: ConfigUnlocker,
  pagina: Pagina
): Promise<ResultadoPagina> {
  const metricas: Partial<MetricasRafaga> = {};
  try {
    const tDescarga = Date.now();
    const resp = await pedirUnlocker(config, pagina.url);
    metricas.ms_descarga = Date.now() - tDescarga;
    if (esErrorTransporteUnlocker(resp)) {
      await manejarTransporteListado(supabase, pagina, config, resp);
      return {
        errores: (pagina.intentos ?? 0) + 1 >= MAX_INTENTOS_TRANSPORTE_LISTADO ? 1 : 0,
        metricas,
      };
    }
    const html = resp.cuerpo;
    const tParse = Date.now();
    const listado = parsearListadoIdealista(html, pagina.url);
    metricas.ms_parseo = Date.now() - tParse;
    const n = listado.items.length;
    const sinListado = n === 0 && !listado.sin_resultados;
    if (sinListado) await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
    const registros = (n === 0 ? [{}] : listado.items).map((item) => ({
      ...item,
      zona_url: pagina.url,
      zona_id: pagina.zona_id,
      page: pagina.page,
      final_url: listado.final_url,
      sin_listado: sinListado,
      items_en_pagina: n,
    }));
    const tIngesta = Date.now();
    const ingesta = await ingestarIdealistaBrightData(registros);
    metricas.ms_ingesta = Date.now() - tIngesta;
    metricas.anuncios = n;
    metricas.nuevos = ingesta.nuevos;
    metricas.actualizados = ingesta.actualizados;
    metricas.sin_cambios = ingesta.sinCambios;
    if (pagina.recogida_id) {
      const tRec = Date.now();
      await anotarYSumarVistos(
        pagina.recogida_id,
        registros,
        pagina.zona_id,
        listado.items.map((item) => item.externo_id),
        sinListado
      );
      metricas.ms_recogida = Date.now() - tRec;
    }
    if (pagina.recogida_id && listado.next_url && pagina.page < TOPE) {
      await encolarPaginas(pagina.recogida_id, [{ url: listado.next_url, zona_id: pagina.zona_id, page: pagina.page + 1 }]);
    } else if (pagina.recogida_id && listado.next_url && pagina.page >= TOPE) {
      await supabase.from("captacion_recogidas").update({ incompleta: true }).eq("collection_id", pagina.recogida_id);
    }
    await supabase.from("captacion_paginas_pendientes").update({ estado: "hecha" }).eq("id", pagina.id);
    return { errores: 0, metricas };
  } catch (error) {
    const cuerpo = error instanceof Error ? error.message : "Página de listado fallida";
    await manejarTransporteListado(supabase, pagina, config, {
      ok: false,
      http_status: 0,
      content_type: null,
      cuerpo,
      bytes: new TextEncoder().encode(cuerpo).length,
    });
    console.error(cuerpo);
    return { errores: 1, metricas };
  }
}

async function procesarTelefonoPagina(
  supabase: ReturnType<typeof createAdminClient>,
  config: ConfigUnlocker,
  pagina: Pagina
): Promise<number> {
  const externoId = externoIdDeUrlTelefono(pagina.url);
  const intentos = pagina.intentos ?? 0;
  try {
    await registrarPedidoTelefono();
    const resp = await pedirUnlocker(config, pagina.url);
    if (esSoloMensajeTelefonoUnlocker(resp)) {
      await aplicarSoloMensaje(externoId, pagina.id);
      return 0;
    }
    if (!esRespuestaTelefonoUnlockerValida(resp)) {
      await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
      await registrarResultadoTelefono("fallo");
      await marcarTelefonoPendiente(externoId, pagina.id, intentos);
      return 1;
    }
    const resultado = await aplicarTelefono(resp.cuerpo, pagina.url);
    if (resultado === "ok" || resultado === "sin_numero") {
      await supabase.from("captacion_paginas_pendientes").update({ estado: "hecha" }).eq("id", pagina.id);
      return 0;
    }
    await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, resp);
    await marcarTelefonoPendiente(externoId, pagina.id, intentos);
    return 0;
  } catch (error) {
    const cuerpo = error instanceof Error ? error.message : "Teléfono fallido";
    await guardarDiagnosticoUnlocker(supabase, pagina.id, config, pagina.url, {
      ok: false,
      http_status: 0,
      content_type: null,
      cuerpo,
      bytes: new TextEncoder().encode(cuerpo).length,
    });
    await registrarResultadoTelefono("fallo");
    await marcarTelefonoPendiente(externoId, pagina.id, intentos);
    return 1;
  }
}

async function tomarPaginasNoTelefono(
  supabase: ReturnType<typeof createAdminClient>,
  limite: number
): Promise<Pagina[]> {
  const { data, error } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id, recogida_id, url, zona_id, page, tipo, intentos")
    .eq("estado", "pendiente")
    .neq("tipo", "telefono")
    .or(`reintentar_en.is.null,reintentar_en.lte.${new Date().toISOString()}`)
    .order("prioridad", { ascending: true })
    .order("page", { ascending: true })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pagina[];
}

async function tomarPaginaTelefono(supabase: ReturnType<typeof createAdminClient>): Promise<Pagina | null> {
  const { data, error } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id, recogida_id, url, zona_id, page, tipo, intentos")
    .eq("estado", "pendiente")
    .eq("tipo", "telefono")
    .or(`reintentar_en.is.null,reintentar_en.lte.${new Date().toISOString()}`)
    .order("prioridad", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Pagina | null) ?? null;
}

export async function encolarPaginas(
  recogidaId: string,
  paginas: Array<{ url: string; zona_id: string; page: number }>
): Promise<void> {
  if (paginas.length === 0) return;
  const { error } = await createAdminClient()
    .from("captacion_paginas_pendientes")
    .upsert(
      paginas.map((pagina) => ({
        recogida_id: recogidaId,
        url: pagina.url,
        zona_id: pagina.zona_id,
        page: pagina.page,
        tipo: "listado",
        prioridad: 0,
        estado: "pendiente",
      })),
      { onConflict: "recogida_id,url", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

/**
 * Hasta 150 páginas por ráfaga, 4 Unlocker en paralelo (listado/ficha), tope 240 s.
 * Prioridad: listado (0) → ficha particular (1) → agencia (2) → teléfono (10).
 */
export async function procesarPaginasPendientes(opts?: OpcionesProcesarPaginas): Promise<{
  paginas: number;
  cerradas: string[];
  errores: number;
  paradaPorTiempo: boolean;
  metricas: MetricasRafaga;
}> {
  const config = configUnlocker();
  if ("error" in config) throw new Error(config.error);
  const supabase = createAdminClient();
  const ahora = opts?.ahora ?? (() => Date.now());
  const t0 = ahora();
  const limitePaginas = opts?.limitePaginas ?? RAFAGA_MAX_PAGINAS;
  const paralelo = opts?.paralelo ?? RAFAGA_PARALELO_UNLOCKER;
  const topeMs = opts?.topeMs ?? RAFAGA_TOPE_MS;
  const limites = { limitePaginas, topeMs };
  const metricas = metricasRafagaVacias();

  let procesadas = 0;
  let errores = 0;
  let paradaPorTiempo = false;

  while (!rafagaDebeParar(t0, ahora(), procesadas, limites)) {
    const cupo = Math.min(paralelo, limitePaginas - procesadas);
    const lote = await tomarPaginasNoTelefono(supabase, cupo);
    if (lote.length === 0) break;

    const resultados = await Promise.all(
      lote.map(async (pagina) => {
        if (pagina.tipo === "ficha") return procesarFichaPagina(supabase, config, pagina);
        return procesarListadoPagina(supabase, config, pagina);
      })
    );
    for (const r of resultados) {
      errores += r.errores;
      acumularMetricas(metricas, r.metricas);
    }
    procesadas += lote.length;

    if (rafagaDebeParar(t0, ahora(), procesadas, limites)) {
      paradaPorTiempo = ahora() - t0 >= topeMs;
      break;
    }
  }

  let telefonos = 0;
  if (!(await telefonosColaPausada())) {
    while (
      telefonos < RAFAGA_TELEFONO_MAX &&
      !rafagaDebeParar(t0, ahora(), procesadas, limites)
    ) {
      if (telefonos > 0) {
        if (rafagaDebeParar(t0, ahora(), procesadas, limites)) break;
        await dormir(RAFAGA_ESPERA_TELEFONO_MS);
        if (rafagaDebeParar(t0, ahora(), procesadas, limites)) {
          paradaPorTiempo = ahora() - t0 >= topeMs;
          break;
        }
      }
      const pagina = await tomarPaginaTelefono(supabase);
      if (!pagina) break;
      if (rafagaDebeParar(t0, ahora(), procesadas, limites)) {
        paradaPorTiempo = ahora() - t0 >= topeMs;
        break;
      }
      const tTel = Date.now();
      errores += await procesarTelefonoPagina(supabase, config, pagina);
      metricas.ms_descarga += Date.now() - tTel;
      telefonos += 1;
      procesadas += 1;
    }
  }

  if (!paradaPorTiempo && ahora() - t0 >= topeMs && procesadas < limitePaginas) {
    paradaPorTiempo = true;
  }

  const cerradas = await intentarCerrarRecogidasAbiertas();
  metricas.paginas = procesadas;
  metricas.errores = errores;
  return { paginas: procesadas, cerradas, errores, paradaPorTiempo, metricas };
}
