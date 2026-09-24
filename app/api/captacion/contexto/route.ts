import { sesionCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const admin = createAdminClient();
  const { count } = await admin
    .from("captacion_recogidas")
    .select("collection_id", { count: "exact", head: true })
    .not("completada", "is", null)
    .or("incompleta.is.null,incompleta.eq.false");
  const { data: cola } = await admin
    .from("captacion_paginas_pendientes")
    .select("url")
    .eq("tipo", "telefono")
    .eq("estado", "pendiente");
  const telefonosEnCola = ((cola ?? []) as Array<{ url?: string }>)
    .map((f) => (f.url?.match(/\/ads\/(\d+)\/contact-phones/) || [])[1])
    .filter((id): id is string => Boolean(id));
  return Response.json({
    ok: true,
    hayRecogidaCompleta: (count ?? 0) > 0,
    telefonosEnCola,
  });
}
