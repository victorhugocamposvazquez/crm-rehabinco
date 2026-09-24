import { encolarFicha } from "@/lib/captacion/brightdata/fichas";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encola una ficha. No llama al Unlocker. */
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
  await encolarFicha(data.externo_id, typeof data.anunciante === "string" ? data.anunciante : null);
  return Response.json({ ok: true });
}
