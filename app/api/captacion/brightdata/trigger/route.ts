import { abrirRecogida, zonasBloqueadas } from "@/lib/captacion/brightdata/recogidas";
import { encolarPaginas } from "@/lib/captacion/brightdata/paginas";
import { paresDeZonas, URL_PROVINCIA_48H, ZONA_PROVINCIA_48H } from "@/lib/captacion/brightdata/zonas";
import { idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { cronAutorizado } from "@/lib/alertas/config";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OperacionZona } from "@/lib/captacion/brightdata/zonas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) {
    const sesion = await sesionAdminCaptacion();
    if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  }

  try {
    const zonas = await idsZonasActivas();
    const operacion: Record<string, OperacionZona> = {};
    const { data } = await createAdminClient().from("captacion_brightdata_zonas").select("id, operacion").in("id", zonas);
    for (const fila of (data ?? []) as Array<{ id?: string; operacion?: string }>) {
      if (fila.id && (fila.operacion === "venta" || fila.operacion === "alquiler")) operacion[fila.id] = fila.operacion;
    }
    const pares = paresDeZonas(zonas, operacion);
    if (pares.length === 0) {
      return Response.json({ ok: false, error: "No hay zonas marcadas. Elige alguna en Ajustes → Captación." }, { status: 400 });
    }
    const bloqueadas = await zonasBloqueadas(zonas);
    if (bloqueadas.length > 0) {
      return Response.json(
        { ok: false, error: `Hay una recogida abierta (menos de 6 h) en: ${bloqueadas.join(", ")}.` },
        { status: 409 }
      );
    }
    const recogidaId = crypto.randomUUID();
    await abrirRecogida(recogidaId, zonas);
    await encolarPaginas(recogidaId, [
      ...pares.map((par) => ({ url: par.url, zona_id: par.zona_id, page: 1 })),
      { url: URL_PROVINCIA_48H, zona_id: ZONA_PROVINCIA_48H, page: 1 },
    ]);
    return Response.json({ ok: true, recogidaId, zonas: pares.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido abrir la recogida." },
      { status: 502 }
    );
  }
}
