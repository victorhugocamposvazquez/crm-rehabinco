import { configBrightDataIdealista, urlWebhookPublica } from "@/lib/captacion/brightdata/config";
import { dispararIdealista } from "@/lib/captacion/brightdata/disparar";
import { esFiltroFecha, filtroDiario, urlConFiltroFecha, type FiltroFecha } from "@/lib/captacion/brightdata/fecha-portal";
import { abrirRecogida, zonasBloqueadas } from "@/lib/captacion/brightdata/recogidas";
import { idsZonasActivas, urlsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { cronAutorizado } from "@/lib/alertas/config";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) {
    const sesion = await sesionAdminCaptacion();
    if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  }

  let filtro: FiltroFecha | null = null;
  try {
    const cuerpo = (await request.json()) as { filtro_fecha?: unknown };
    if (typeof cuerpo.filtro_fecha === "string" && cuerpo.filtro_fecha) {
      if (!esFiltroFecha(cuerpo.filtro_fecha)) {
        return Response.json({ ok: false, error: "Filtro de fecha no válido." }, { status: 400 });
      }
      filtro = cuerpo.filtro_fecha;
    }
  } catch {
    filtro = null;
  }

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  try {
    const zonas = await idsZonasActivas();
    const completas = await urlsZonasActivas();
    const urls = filtro
      ? completas.map((url) => urlConFiltroFecha(url, filtro))
      : [...completas, ...completas.map((url) => urlConFiltroFecha(url, filtroDiario(url)))];
    if (urls.length === 0) {
      return Response.json(
        { ok: false, error: "No hay zonas marcadas. Elige alguna en Ajustes → Captación." },
        { status: 400 }
      );
    }
    if (!filtro) {
      const bloqueadas = await zonasBloqueadas(zonas);
      if (bloqueadas.length > 0) {
        return Response.json(
          { ok: false, error: `Hay una recogida abierta (menos de 6 h) en: ${bloqueadas.join(", ")}.` },
          { status: 409 }
        );
      }
    }
    const { snapshotId } = await dispararIdealista(config, urlWebhookPublica(request), urls);
    if (!filtro) await abrirRecogida(snapshotId, zonas);
    return Response.json({ ok: true, snapshotId, zonas: urls.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido lanzar Idealista." },
      { status: 502 }
    );
  }
}
