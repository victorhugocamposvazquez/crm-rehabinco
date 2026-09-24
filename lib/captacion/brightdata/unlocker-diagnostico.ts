import type { RespuestaUnlocker, UnlockerConfig } from "@/lib/captacion/brightdata/unlocker";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function guardarDiagnosticoUnlocker(
  supabase: SupabaseClient,
  paginaId: string,
  config: UnlockerConfig,
  url: string,
  resp: RespuestaUnlocker
): Promise<void> {
  await supabase
    .from("captacion_paginas_pendientes")
    .update({
      unlocker_zone: config.zone,
      unlocker_url: url,
      http_status: resp.http_status,
      content_type: resp.content_type,
      bytes: resp.bytes,
      cuerpo_muestra: resp.cuerpo.slice(0, 3000),
    })
    .eq("id", paginaId);
}
