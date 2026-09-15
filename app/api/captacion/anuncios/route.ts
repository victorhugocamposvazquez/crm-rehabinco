import { parseFaseAnuncio, parseFuentePortal } from "@/lib/captacion/portales/modelo";
import { sesionCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sesion = await sesionCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const url = new URL(request.url);
  const fuente = parseFuentePortal(url.searchParams.get("fuente"));
  const anunciante = url.searchParams.get("anunciante");
  const operacion = url.searchParams.get("operacion");
  const municipio = url.searchParams.get("municipio")?.trim();
  const faseRaw = url.searchParams.get("fase") ?? url.searchParams.get("estado");
  const comercial = url.searchParams.get("comercial");

  let query = sesion.supabase.from("captacion_anuncios").select("*").order("visto_en", { ascending: false });
  if (fuente) query = query.eq("fuente", fuente);
  if (anunciante === "particular" || anunciante === "empresa" || anunciante === "banco" || anunciante === "desconocido") {
    query = query.eq("anunciante", anunciante);
  }
  if (operacion === "venta" || operacion === "alquiler") query = query.eq("operacion", operacion);
  if (municipio) query = query.ilike("municipio", `%${municipio}%`);
  if (faseRaw) query = query.eq("fase", parseFaseAnuncio(faseRaw));
  if (comercial) query = query.eq("comercial_id", comercial);

  const { data, error } = await query;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, anuncios: data ?? [] });
}
