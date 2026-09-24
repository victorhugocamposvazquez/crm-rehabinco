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
    .select("iniciada, completada, incompleta, zonas, registros, externos, sospechosas")
    .order("iniciada", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sospechosas =
    data?.sospechosas && typeof data.sospechosas === "object" ? data.sospechosas : {};
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
  return Response.json({
    ok: true,
    activas,
    estimados: await estimadosZonas(),
    anuncios: anunciosDeZonas(activas),
    zonas: ZONAS_IDEALISTA,
    sospechosas,
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
