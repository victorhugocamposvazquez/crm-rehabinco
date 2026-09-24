import { abrirRecogida } from "@/lib/captacion/brightdata/recogidas";
import { encolarPaginas } from "@/lib/captacion/brightdata/paginas";
import { FILTROS_FECHA, urlConFiltroFecha, type FiltroFecha } from "@/lib/captacion/brightdata/fecha-portal";
import { paresDeZonas } from "@/lib/captacion/brightdata/zonas";
import { idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ORDEN: FiltroFecha[] = ["24h", "48h", "7d", "30d"];

/** Encola las cuatro franjas. No forma parte de los retirados: la recogida no lleva zonas. */
export async function POST() {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  try {
    const pares = paresDeZonas(await idsZonasActivas());
    if (pares.length === 0) return Response.json({ ok: false, error: "No hay zonas marcadas." }, { status: 400 });
    const recogidaId = crypto.randomUUID();
    await abrirRecogida(recogidaId, []);
    await encolarPaginas(
      recogidaId,
      ORDEN.flatMap((filtro) => pares.map((par) => ({ url: urlConFiltroFecha(par.url, filtro), zona_id: par.zona_id, page: 1 })))
    );
    return Response.json({ ok: true, recogidaId, zonas: pares.length, filtros: Object.keys(FILTROS_FECHA) });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se han podido clasificar las fechas." },
      { status: 502 }
    );
  }
}
