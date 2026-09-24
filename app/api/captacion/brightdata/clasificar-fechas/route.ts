import { configBrightDataIdealista, urlWebhookPublica } from "@/lib/captacion/brightdata/config";
import { dispararIdealista } from "@/lib/captacion/brightdata/disparar";
import { FILTROS_FECHA, urlConFiltroFecha, type FiltroFecha } from "@/lib/captacion/brightdata/fecha-portal";
import { urlsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ORDEN: FiltroFecha[] = ["24h", "48h", "7d", "30d"];

/** Una sola recogida con las cuatro franjas. No abre captacion_recogidas: no retira anuncios. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  try {
    const completas = await urlsZonasActivas();
    if (completas.length === 0) {
      return Response.json({ ok: false, error: "No hay zonas marcadas." }, { status: 400 });
    }
    const urls = ORDEN.flatMap((filtro) => completas.map((url) => urlConFiltroFecha(url, filtro)));
    const { snapshotId } = await dispararIdealista(config, urlWebhookPublica(request), urls);
    return Response.json({ ok: true, snapshotId, zonas: completas.length, filtros: Object.keys(FILTROS_FECHA) });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se han podido clasificar las fechas." },
      { status: 502 }
    );
  }
}
