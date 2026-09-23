import { aplicarDatosPortalGuardados } from "@/lib/captacion/brightdata/ingestar";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Escribe teléfono y fecha que ya están en el JSON guardado y no en la ficha. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let desde = 0;
  try {
    const cuerpo = (await request.json()) as { desde?: unknown };
    desde = typeof cuerpo.desde === "number" && Number.isFinite(cuerpo.desde) ? Math.max(0, Math.floor(cuerpo.desde)) : 0;
  } catch {
    desde = 0;
  }

  try {
    const resultado = await aplicarDatosPortalGuardados(desde);
    return Response.json({ ok: resultado.errores.length === 0, ...resultado });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se han podido completar las fichas." },
      { status: 502 }
    );
  }
}
