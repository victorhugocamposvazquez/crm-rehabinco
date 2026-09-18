import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalAdapter } from "../adapters/types.js";

export async function encolarListadosPendientes(supabase: SupabaseClient): Promise<number> {
  const ahora = new Date();
  const { data: alertas, error } = await supabase
    .from("captacion_alertas")
    .select("id, portal_id, municipio, provincia, operacion, tipos_inmueble, portal_params, cadencia_minutos, proxima_ejecucion, portales")
    .eq("activa", true);
  if (error) throw new Error(error.message);

  let encolados = 0;
  for (const alerta of alertas ?? []) {
    const portalId = (alerta.portal_id as string | null) ?? (alerta.portales as string[] | null)?.[0];
    if (!portalId) continue;

    const { data: portal } = await supabase
      .from("captacion_portales")
      .select("id, activo")
      .eq("id", portalId)
      .maybeSingle();
    if (!portal?.activo) continue;

    const proxima = alerta.proxima_ejecucion ? new Date(alerta.proxima_ejecucion) : null;
    if (proxima && proxima.getTime() > ahora.getTime()) continue;

    const cadencia = alerta.cadencia_minutos ?? 120;
    const urlPlaceholder = `scheduler://${portalId}/${alerta.id}/listado/1`;

    const { error: insErr } = await supabase.from("crawl_jobs").insert({
      tipo: "listado",
      portal_id: portalId,
      alerta_id: alerta.id,
      url: urlPlaceholder,
      prioridad: 40,
      payload: {
        pagina: 1,
        municipio: alerta.municipio,
        provincia: alerta.provincia,
        operacion: alerta.operacion,
        tipos_inmueble: alerta.tipos_inmueble,
        portal_params: alerta.portal_params,
      },
    });
    if (insErr) continue;

    await supabase
      .from("captacion_alertas")
      .update({
        proxima_ejecucion: new Date(ahora.getTime() + cadencia * 60_000).toISOString(),
        updated_at: ahora.toISOString(),
      })
      .eq("id", alerta.id);

    encolados += 1;
  }
  return encolados;
}

export function zonaDesdeJob(job: {
  alerta_id: string | null;
  portal_id: string;
  payload: Record<string, unknown>;
}): import("../adapters/types.js").ZonaContratada {
  return {
    id: job.alerta_id ?? job.portal_id,
    portal_id: job.portal_id as import("../adapters/types.js").Portal,
    municipio: (job.payload.municipio as string | null) ?? null,
    provincia: (job.payload.provincia as string | null) ?? null,
    operacion: job.payload.operacion === "alquiler" ? "alquiler" : "venta",
    tipos_inmueble: (job.payload.tipos_inmueble as string[]) ?? [],
    portal_params: (job.payload.portal_params as Record<string, unknown>) ?? {},
  };
}

export function urlListado(adapter: PortalAdapter, job: { payload: Record<string, unknown> }, alertaId: string | null, portalId: string): string {
  const pagina = Number(job.payload.pagina ?? 1);
  const zona = zonaDesdeJob({ alerta_id: alertaId, portal_id: portalId, payload: job.payload });
  return adapter.buildListUrl(zona, pagina);
}
