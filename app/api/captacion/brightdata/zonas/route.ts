import { createAdminClient } from "@/lib/supabase/admin";
import { estimadosZonas, guardarZonasActivas, idsZonasActivas } from "@/lib/captacion/brightdata/zonas-guardadas";
import { ZONAS_IDEALISTA, anunciosDeZonas } from "@/lib/captacion/brightdata/zonas";
import { metricasTelefonos } from "@/lib/captacion/brightdata/telefonos-metricas";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const activas = await idsZonasActivas();
  const admin = createAdminClient();
  const { data } = await admin
    .from("captacion_recogidas")
    .select("collection_id, iniciada, completada, incompleta, zonas, registros, externos, sospechosas")
    .order("iniciada", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sospechosas =
    data?.sospechosas && typeof data.sospechosas === "object" ? (data.sospechosas as Record<string, string>) : {};
  const idsSospechosas = Object.keys(sospechosas);
  const diagnosticos: Record<
    string,
    {
      unlocker_zone: string | null;
      unlocker_url: string | null;
      http_status: number | null;
      content_type: string | null;
      bytes: number | null;
      cuerpo_muestra: string | null;
    }
  > = {};
  if (idsSospechosas.length > 0 && typeof data?.collection_id === "string") {
    const { data: paginas } = await admin
      .from("captacion_paginas_pendientes")
      .select("zona_id, unlocker_zone, unlocker_url, http_status, content_type, bytes, cuerpo_muestra")
      .eq("recogida_id", data.collection_id)
      .in("zona_id", idsSospechosas)
      .not("cuerpo_muestra", "is", null);
    for (const fila of (paginas ?? []) as Array<{
      zona_id: string;
      unlocker_zone: string | null;
      unlocker_url: string | null;
      http_status: number | null;
      content_type: string | null;
      bytes: number | null;
      cuerpo_muestra: string | null;
    }>) {
      if (!diagnosticos[fila.zona_id]) diagnosticos[fila.zona_id] = fila;
    }
  }
  let ultima: {
    fecha: string;
    zonas: string[];
    vistos: number;
    nuevos: number;
    retirados: number;
    estado: "abierta" | "completa" | "incompleta";
  } | null = null;
  if (data?.iniciada) {
    const fin = typeof data.completada === "string" ? data.completada : new Date().toISOString();
    const [nuevos, retirados] = await Promise.all([
      admin
        .from("captacion_anuncios")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", "idealista")
        .gte("visto_primera_vez", data.iniciada)
        .lte("visto_primera_vez", fin),
      admin
        .from("captacion_anuncios")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", "idealista")
        .gte("desaparecido_en", data.iniciada)
        .lte("desaparecido_en", fin),
    ]);
    const externos = Array.isArray(data.externos) ? data.externos.length : 0;
    ultima = {
      fecha: typeof data.completada === "string" ? data.completada : data.iniciada,
      zonas: Array.isArray(data.zonas) ? data.zonas.filter((id): id is string => typeof id === "string") : [],
      vistos: typeof data.registros === "number" ? data.registros : externos,
      nuevos: nuevos.count ?? 0,
      retirados: retirados.count ?? 0,
      estado: !data.completada ? "abierta" : data.incompleta ? "incompleta" : "completa",
    };
  }
  const { data: telDiag } = await admin
    .from("captacion_paginas_pendientes")
    .select("id, url, unlocker_zone, unlocker_url, http_status, content_type, bytes, cuerpo_muestra, intentos, estado")
    .eq("tipo", "telefono")
    .not("cuerpo_muestra", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5);
  const diagnosticosTelefono = ((telDiag ?? []) as Array<{
    id: string;
    url: string | null;
    unlocker_zone: string | null;
    unlocker_url: string | null;
    http_status: number | null;
    content_type: string | null;
    bytes: number | null;
    cuerpo_muestra: string | null;
    intentos: number | null;
    estado: string | null;
  }>).map((fila) => ({
    id: fila.id,
    url: fila.url,
    unlocker_zone: fila.unlocker_zone,
    unlocker_url: fila.unlocker_url,
    http_status: fila.http_status,
    content_type: fila.content_type,
    bytes: fila.bytes,
    cuerpo_muestra: fila.cuerpo_muestra,
    intentos: fila.intentos,
    estado: fila.estado,
  }));

  return Response.json({
    ok: true,
    activas,
    estimados: await estimadosZonas(),
    anuncios: anunciosDeZonas(activas),
    zonas: ZONAS_IDEALISTA,
    sospechosas,
    diagnosticos,
    diagnosticosTelefono,
    ultima,
    fichasPendientes: (
      await admin
        .from("captacion_anuncios")
        .select("id", { count: "exact", head: true })
        .eq("portal_id", "idealista")
        .eq("enriquecido_ficha", false)
        .is("desaparecido_en", null)
    ).count ?? 0,
    telefonos: await metricasTelefonos(),
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
