import { estimadosZonas, guardarZonasActivas, idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
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
    estimados: await estimadosZonas(),
    anuncios: anunciosDeZonas(activas),
    zonas: ZONAS_IDEALISTA,
  });
}

export async function PUT(request: Request) {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let cuerpo: { activas?: unknown; estimados?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!Array.isArray(cuerpo.activas) || cuerpo.activas.some((id) => typeof id !== "string")) {
    return Response.json({ ok: false, error: "Marca las zonas con una lista de ids." }, { status: 400 });
  }
  const estimados: Record<string, number | null> = {};
  if (cuerpo.estimados && typeof cuerpo.estimados === "object" && !Array.isArray(cuerpo.estimados)) {
    for (const [id, valor] of Object.entries(cuerpo.estimados as Record<string, unknown>)) {
      if (typeof valor === "number" && Number.isFinite(valor)) estimados[id] = Math.round(valor);
    }
  }
  const resultado = await guardarZonasActivas(cuerpo.activas, estimados);
  if (!resultado.ok) return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  const activas = await idsZonasActivas();
  return Response.json({ ok: true, activas, estimados: await estimadosZonas(), anuncios: anunciosDeZonas(activas) });
}
