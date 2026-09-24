import { evaluarEstadoCaptacion } from "@/lib/captacion/brightdata/estado-captacion";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  try {
    const estado = await evaluarEstadoCaptacion();
    return Response.json({ ok: true, ...estado });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo evaluar el estado." },
      { status: 502 }
    );
  }
}
