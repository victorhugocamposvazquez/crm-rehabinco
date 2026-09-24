import { encolarFichasPendientes } from "@/lib/captacion/brightdata/fichas";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encola hasta 300 fichas. No llama al Unlocker. */
export async function POST() {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const encoladas = await encolarFichasPendientes(300);
  return Response.json({ ok: true, encoladas });
}
