import { configBrightDataIdealista, urlWebhookPublica } from "@/lib/captacion/brightdata/config";
import { dispararIdealista } from "@/lib/captacion/brightdata/disparar";
import { abrirRecogida, zonasBloqueadas } from "@/lib/captacion/brightdata/recogidas";
import { idsZonasActivas, urlsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  try {
    const zonas = await idsZonasActivas();
    const urls = await urlsZonasActivas();
    if (urls.length === 0) {
      return Response.json(
        { ok: false, error: "No hay zonas marcadas. Elige alguna en Ajustes → Captación." },
        { status: 400 }
      );
    }
    const bloqueadas = await zonasBloqueadas(zonas);
    if (bloqueadas.length > 0) {
      return Response.json(
        { ok: false, error: `Hay una recogida abierta (menos de 6 h) en: ${bloqueadas.join(", ")}.` },
        { status: 409 }
      );
    }
    const { snapshotId } = await dispararIdealista(config, urlWebhookPublica(request), urls);
    await abrirRecogida(snapshotId, zonas);
    return Response.json({ ok: true, snapshotId, zonas: urls.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido lanzar Idealista." },
      { status: 502 }
    );
  }
}
