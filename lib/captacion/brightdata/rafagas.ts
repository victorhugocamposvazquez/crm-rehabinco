import { hayRecogidasAbiertas, hayTrabajoPendienteCola } from "@/lib/captacion/brightdata/cola-pendiente";
import { decidirEarlyExit } from "@/lib/captacion/brightdata/early-exit-decision";
import { logMetricasRafaga, metricasRafagaVacias, type MetricasRafaga } from "@/lib/captacion/brightdata/metricas-rafaga";
import { cupoPaginasRafagaPresupuesto } from "@/lib/captacion/brightdata/presupuesto-unlocker";
import { createAdminClient } from "@/lib/supabase/admin";
import { procesarPaginasPendientes } from "@/lib/captacion/brightdata/paginas";
import { adquirirLockProcesar, liberarLockProcesar } from "@/lib/captacion/brightdata/procesar-lock";
import { intentarCerrarRecogidasAbiertas } from "@/lib/captacion/brightdata/recogidas";

export type RafagaCaptacion = {
  id: string;
  iniciada_en: string;
  terminada_en: string | null;
  paginas: number;
  errores: number;
  ok: boolean | null;
  motivo: string | null;
  duracion_ms: number | null;
};

export async function registrarRafagaOmitida(motivo: string): Promise<void> {
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();
  await supabase.from("captacion_rafagas").insert({
    iniciada_en: ahora,
    terminada_en: ahora,
    paginas: 0,
    errores: 0,
    ok: true,
    motivo,
    duracion_ms: 0,
  });
}

async function iniciarRafaga(): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("captacion_rafagas")
    .insert({ ok: null })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message ?? "No se pudo abrir la ráfaga.");
  return data.id as string;
}

async function cerrarRafaga(
  id: string,
  fin: { paginas: number; errores: number; ok: boolean; motivo?: string | null; duracionMs: number }
): Promise<void> {
  await createAdminClient()
    .from("captacion_rafagas")
    .update({
      terminada_en: new Date().toISOString(),
      paginas: fin.paginas,
      errores: fin.errores,
      ok: fin.ok,
      motivo: fin.motivo ?? null,
      duracion_ms: fin.duracionMs,
    })
    .eq("id", id);
}

export type ResultadoRafagaProcesar = {
  paginas: number;
  errores: number;
  cerradas: string[];
  omitida?: boolean;
  motivo?: string | null;
  metricas?: MetricasRafaga;
};

/** Una ráfaga completa (lock + procesar + historial). */
export async function ejecutarRafagaProcesar(): Promise<ResultadoRafagaProcesar> {
  const t0 = Date.now();

  // Early exit: sin cola ni recogidas abiertas → no lock, Unlocker, Cheerio ni presupuesto.
  // Con recogidas abiertas y cola vacía → cierra (retirados) sin Unlocker.
  const hayCola = await hayTrabajoPendienteCola();
  const decision = decidirEarlyExit(hayCola, hayCola ? false : await hayRecogidasAbiertas());
  if (decision.accion === "omitir_sin_lock") {
    const metricas = metricasRafagaVacias();
    metricas.ms_total = Date.now() - t0;
    metricas.omitida = true;
    metricas.motivo = decision.motivo;
    await registrarRafagaOmitida(decision.motivo);
    logMetricasRafaga(metricas);
    return { paginas: 0, errores: 0, cerradas: [], omitida: true, motivo: decision.motivo, metricas };
  }
  if (decision.accion === "cerrar_recogidas") {
    if (!(await adquirirLockProcesar())) {
      await registrarRafagaOmitida("lock_ocupado");
      return { paginas: 0, errores: 0, cerradas: [], omitida: true, motivo: "lock_ocupado" };
    }
    try {
      const cerradas = await intentarCerrarRecogidasAbiertas();
      const metricas = metricasRafagaVacias();
      metricas.ms_total = Date.now() - t0;
      metricas.omitida = true;
      metricas.motivo = decision.motivo;
      await registrarRafagaOmitida(decision.motivo);
      logMetricasRafaga(metricas);
      return { paginas: 0, errores: 0, cerradas, omitida: true, motivo: decision.motivo, metricas };
    } finally {
      await liberarLockProcesar();
    }
  }

  if (!(await adquirirLockProcesar())) {
    await registrarRafagaOmitida("lock_ocupado");
    return { paginas: 0, errores: 0, cerradas: [], omitida: true, motivo: "lock_ocupado" };
  }

  // Re-check tras el lock: otra ráfaga pudo vaciar la cola.
  if (!(await hayTrabajoPendienteCola())) {
    try {
      const cerradas = await intentarCerrarRecogidasAbiertas();
      const metricas = metricasRafagaVacias();
      metricas.ms_total = Date.now() - t0;
      metricas.omitida = true;
      metricas.motivo = "cola_vacia";
      await registrarRafagaOmitida("cola_vacia");
      logMetricasRafaga(metricas);
      return { paginas: 0, errores: 0, cerradas, omitida: true, motivo: "cola_vacia", metricas };
    } finally {
      await liberarLockProcesar();
    }
  }

  const presupuesto = await cupoPaginasRafagaPresupuesto();
  if (presupuesto.omitir) {
    await registrarRafagaOmitida(presupuesto.omitir);
    await liberarLockProcesar();
    return { paginas: 0, errores: 0, cerradas: [], omitida: true, motivo: presupuesto.omitir };
  }
  const id = await iniciarRafaga();
  try {
    const resultado = await procesarPaginasPendientes({ limitePaginas: presupuesto.cupo });
    const duracionMs = Date.now() - t0;
    await cerrarRafaga(id, {
      paginas: resultado.paginas,
      errores: resultado.errores,
      ok: true,
      motivo: resultado.paradaPorTiempo ? "tope_tiempo" : null,
      duracionMs,
    });
    const metricas: MetricasRafaga = {
      ...resultado.metricas,
      paginas: resultado.paginas,
      errores: resultado.errores,
      ms_total: duracionMs,
    };
    logMetricasRafaga(metricas);
    return {
      paginas: resultado.paginas,
      errores: resultado.errores,
      cerradas: resultado.cerradas,
      metricas,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ráfaga fallida";
    await cerrarRafaga(id, {
      paginas: 0,
      errores: 1,
      ok: false,
      motivo: msg,
      duracionMs: Date.now() - t0,
    });
    return { paginas: 0, errores: 1, cerradas: [], motivo: msg };
  } finally {
    await liberarLockProcesar();
  }
}

export async function ultimaRafaga(): Promise<RafagaCaptacion | null> {
  const { data, error } = await createAdminClient()
    .from("captacion_rafagas")
    .select("id, iniciada_en, terminada_en, paginas, errores, ok, motivo, duracion_ms")
    .order("iniciada_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as RafagaCaptacion;
}
