import type { SupabaseClient } from "@supabase/supabase-js";

const VENTANA_MS = 15 * 60 * 1000;
const UMBRAL = 3;
const PAUSA_MS = 60 * 60 * 1000;

export async function portalBloqueado(supabase: SupabaseClient, portalId: string): Promise<boolean> {
  const { data } = await supabase
    .from("crawl_portal_estado")
    .select("bloqueado_hasta")
    .eq("portal_id", portalId)
    .maybeSingle();
  if (!data?.bloqueado_hasta) return false;
  return new Date(data.bloqueado_hasta).getTime() > Date.now();
}

export async function registrarBloqueoPortal(supabase: SupabaseClient, portalId: string): Promise<void> {
  const ahora = new Date();
  const { data: prev } = await supabase
    .from("crawl_portal_estado")
    .select("*")
    .eq("portal_id", portalId)
    .maybeSingle();

  let bloqueos = 1;
  let ventanaDesde = ahora.toISOString();
  if (prev?.ventana_desde) {
    const ventanaInicio = new Date(prev.ventana_desde).getTime();
    if (ahora.getTime() - ventanaInicio <= VENTANA_MS) {
      bloqueos = (prev.bloqueos_recientes ?? 0) + 1;
      ventanaDesde = prev.ventana_desde;
    }
  }

  const bloqueadoHasta =
    bloqueos >= UMBRAL ? new Date(ahora.getTime() + PAUSA_MS).toISOString() : prev?.bloqueado_hasta ?? null;

  await supabase.from("crawl_portal_estado").upsert({
    portal_id: portalId,
    bloqueos_recientes: bloqueos,
    ventana_desde: ventanaDesde,
    bloqueado_hasta: bloqueadoHasta,
    updated_at: ahora.toISOString(),
  });
}

export async function pausarPortalSinProxy(
  supabase: SupabaseClient,
  portalId: string,
  pausaMs = 30 * 60 * 1000
): Promise<string> {
  const bloqueadoHasta = new Date(Date.now() + pausaMs).toISOString();
  await supabase.from("crawl_portal_estado").upsert({
    portal_id: portalId,
    bloqueado_hasta: bloqueadoHasta,
    updated_at: new Date().toISOString(),
  });
  return bloqueadoHasta;
}

export async function limpiarBloqueoPortal(supabase: SupabaseClient, portalId: string): Promise<void> {
  await supabase.from("crawl_portal_estado").upsert({
    portal_id: portalId,
    bloqueos_recientes: 0,
    ventana_desde: null,
    bloqueado_hasta: null,
    updated_at: new Date().toISOString(),
  });
}
