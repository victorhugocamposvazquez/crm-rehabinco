import { abrirRecogida, zonasBloqueadas } from "@/lib/captacion/brightdata/recogidas";
import { encolarPaginas } from "@/lib/captacion/brightdata/paginas";
import { esRecogidaSoloNovedades } from "@/lib/captacion/brightdata/novedades";
import { URL_PROVINCIA_48H, ZONA_PROVINCIA_48H } from "@/lib/captacion/brightdata/zonas";
import { idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { cronAutorizado } from "@/lib/alertas/config";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Sondeo rápido: solo el filtro provincia 48 h.
 * No re-pagina municipios ni marca retirados (eso queda en la pasada diaria /trigger).
 */
export async function POST(request: Request) {
  if (!cronAutorizado(request)) {
    const sesion = await sesionAdminCaptacion();
    if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  }

  try {
    const zonas = await idsZonasActivas();
    if (zonas.length === 0) {
      return Response.json({ ok: false, error: "No hay zonas marcadas. Elige alguna en Ajustes → Captación." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { count: pendientes48h } = await supabase
      .from("captacion_paginas_pendientes")
      .select("id", { count: "exact", head: true })
      .eq("zona_id", ZONA_PROVINCIA_48H)
      .eq("tipo", "listado")
      .eq("estado", "pendiente");
    if ((pendientes48h ?? 0) > 0) {
      return Response.json({ ok: true, omitido: true, motivo: "Ya hay páginas de novedades en cola." });
    }

    const bloqueadas = await zonasBloqueadas([ZONA_PROVINCIA_48H]);
    if (bloqueadas.length > 0) {
      return Response.json({ ok: true, omitido: true, motivo: "Hay un sondeo de novedades abierto." });
    }

    const { data: abiertas } = await supabase
      .from("captacion_recogidas")
      .select("zonas")
      .is("completada", null);
    const hayNovedadesAbierta = ((abiertas ?? []) as Array<{ zonas?: string[] }>).some((fila) =>
      esRecogidaSoloNovedades(fila.zonas)
    );
    if (hayNovedadesAbierta) {
      return Response.json({ ok: true, omitido: true, motivo: "Hay un sondeo de novedades abierto." });
    }

    const recogidaId = crypto.randomUUID();
    await abrirRecogida(recogidaId, [ZONA_PROVINCIA_48H]);
    await encolarPaginas(recogidaId, [{ url: URL_PROVINCIA_48H, zona_id: ZONA_PROVINCIA_48H, page: 1 }]);
    return Response.json({ ok: true, recogidaId, modo: "novedades" });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido abrir el sondeo de novedades." },
      { status: 502 }
    );
  }
}
