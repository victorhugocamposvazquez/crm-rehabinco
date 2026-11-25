import { parseEstadoNota, puedePasar, type EstadoNota } from "@/lib/notas-simples/modelo";
import { BUCKET_DOCS_INMUEBLE } from "@/lib/inmuebles/documentos";
import { proveedorActivo } from "@/lib/notas-simples/proveedor";
import { COLUMNAS_NOTA, sesionNotas, sinSesion } from "@/lib/notas-simples/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { supabase, user } = await sesionNotas();
  if (!user) return sinSesion();
  const { data, error } = await supabase.from("notas_simples").select(COLUMNAS_NOTA).eq("id", id).maybeSingle();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return Response.json({ ok: false, error: "No existe esta nota." }, { status: 404 });
  let pdfUrl: string | null = null;
  if (data.pdf_path) {
    const { data: firmada } = await supabase.storage.from(BUCKET_DOCS_INMUEBLE).createSignedUrl(data.pdf_path, 60 * 10);
    pdfUrl = firmada?.signedUrl ?? null;
  }
  const s = {
    refCatastral: data.ref_catastral,
    idufir: data.idufir,
    fincaRegistral: data.finca_registral,
    registro: data.registro,
    direccion: data.direccion,
    municipio: data.municipio,
    provincia: data.provincia,
    titular: data.titular,
    motivo: data.motivo,
    motivoTexto: data.motivo_texto,
    propiedadId: data.propiedad_id,
  };
  return Response.json({ ok: true, nota: data, pdfUrl, instrucciones: proveedorActivo().instrucciones(s) });
}

/** Cambia el estado (en trámite, incidencia, cancelar, reintentar) o anota la referencia del proveedor. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { supabase, user } = await sesionNotas();
  if (!user) return sinSesion();
  let cuerpo: { estado?: unknown; incidencia?: unknown; proveedorRef?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const { data: actual } = await supabase.from("notas_simples").select("estado").eq("id", id).maybeSingle();
  if (!actual) return Response.json({ ok: false, error: "No existe esta nota." }, { status: 404 });

  const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const estado = cuerpo.estado === undefined ? null : parseEstadoNota(cuerpo.estado);
  if (cuerpo.estado !== undefined) {
    if (!estado || estado === "recibida" || !puedePasar(actual.estado as EstadoNota, estado)) {
      return Response.json({ ok: false, error: "Ese cambio de estado no es posible." }, { status: 400 });
    }
    cambios.estado = estado;
    if (estado === "error") cambios.incidencia = typeof cuerpo.incidencia === "string" ? cuerpo.incidencia.slice(0, 500) : "Incidencia sin detallar";
    if (estado === "solicitada") cambios.incidencia = null;
  }
  if (typeof cuerpo.proveedorRef === "string") cambios.proveedor_ref = cuerpo.proveedorRef.trim().slice(0, 120) || null;

  const { data, error } = await supabase.from("notas_simples").update(cambios).eq("id", id).select(COLUMNAS_NOTA).single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, nota: data });
}
