import { contarFichasEnCola, encolarFichasPendientes } from "@/lib/captacion/brightdata/fichas";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Encola hasta 300 fichas. No llama al Unlocker. */
export async function POST() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  try {
    const resultado = await encolarFichasPendientes(300);
    const fichasEnCola = await contarFichasEnCola();
    return Response.json({ ok: true, ...resultado, fichasEnCola });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudieron encolar fichas." },
      { status: 500 }
    );
  }
}
