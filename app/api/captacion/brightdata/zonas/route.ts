import { guardarZonasActivas, idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { ZONAS_IDEALISTA, anunciosDeZonas } from "@/lib/captacion/brightdata/zonas";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const activas = await idsZonasActivas();
  return Response.json({
    ok: true,
    activas,
    anuncios: anunciosDeZonas(activas),
    zonas: ZONAS_IDEALISTA,
  });
}

export async function PUT(request: Request) {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let cuerpo: { activas?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!Array.isArray(cuerpo.activas) || cuerpo.activas.some((id) => typeof id !== "string")) {
    return Response.json({ ok: false, error: "Marca las zonas con una lista de ids." }, { status: 400 });
  }
  const resultado = await guardarZonasActivas(cuerpo.activas);
  if (!resultado.ok) return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  const activas = await idsZonasActivas();
  return Response.json({ ok: true, activas, anuncios: anunciosDeZonas(activas) });
}
