import { encolarTelefono } from "@/lib/captacion/brightdata/telefonos";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encola contact-phones. No llama al Unlocker. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  let id = "";
  try {
    id = String(((await request.json()) as { id?: unknown }).id ?? "");
  } catch {
    id = "";
  }
  const { data } = await createAdminClient()
    .from("captacion_anuncios")
    .select("externo_id, anunciante, portal_id")
    .eq("id", id)
    .maybeSingle();
  if (data?.portal_id !== "idealista" || typeof data.externo_id !== "string") {
    return Response.json({ ok: false, error: "Anuncio de Idealista no encontrado." }, { status: 404 });
  }
  await encolarTelefono(data.externo_id, {
    demanda: true,
    anunciante: typeof data.anunciante === "string" ? data.anunciante : null,
  });
  return Response.json({ ok: true });
}
