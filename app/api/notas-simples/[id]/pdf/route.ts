import { BUCKET_DOCS_INMUEBLE } from "@/lib/inmuebles/documentos";
import { puedePasar, rutaPdfNota, type EstadoNota } from "@/lib/notas-simples/modelo";
import { leerNotaSimple } from "@/lib/notas-simples/leer";
import { COLUMNAS_NOTA, sesionNotas, sinSesion } from "@/lib/notas-simples/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sube el PDF recibido del Registro (campo "pdf"), lo guarda, lo adjunta al
 * inmueble si la nota está vinculada y lo lee con IA. Con ?releer=1 y sin
 * archivo, vuelve a leer el PDF ya guardado.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { supabase, user } = await sesionNotas();
  if (!user) return sinSesion();
  const { data: nota } = await supabase
    .from("notas_simples")
    .select("id, estado, propiedad_id, direccion, pdf_path, documento_id")
    .eq("id", id)
    .maybeSingle();
  if (!nota) return Response.json({ ok: false, error: "No existe esta nota." }, { status: 404 });

  const releer = new URL(request.url).searchParams.get("releer") === "1";
  let bytes: Uint8Array;
  const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (releer) {
    if (!nota.pdf_path) return Response.json({ ok: false, error: "Esta nota aún no tiene PDF." }, { status: 400 });
    const { data: blob, error } = await supabase.storage.from(BUCKET_DOCS_INMUEBLE).download(nota.pdf_path);
    if (error || !blob) return Response.json({ ok: false, error: "No se ha podido abrir el PDF guardado." }, { status: 500 });
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    const estado = nota.estado as EstadoNota;
    if (estado !== "recibida" && estado !== "leida" && !puedePasar(estado, "recibida")) {
      return Response.json({ ok: false, error: "Esta nota está cancelada." }, { status: 400 });
    }
    const form = await request.formData().catch(() => null);
    const archivo = form?.get("pdf");
    if (!(archivo instanceof File)) return Response.json({ ok: false, error: "Adjunta el PDF de la nota simple." }, { status: 400 });
    if (archivo.size > MAX_BYTES) return Response.json({ ok: false, error: "El PDF pesa más de 15 MB." }, { status: 400 });
    bytes = new Uint8Array(await archivo.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return Response.json({ ok: false, error: "El archivo no es un PDF." }, { status: 400 });

    const path = rutaPdfNota(id);
    const { error: eSubida } = await supabase.storage
      .from(BUCKET_DOCS_INMUEBLE)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (eSubida) return Response.json({ ok: false, error: `No se ha podido guardar el PDF: ${eSubida.message}` }, { status: 500 });
    Object.assign(cambios, { pdf_path: path, estado: "recibida", recibida_en: new Date().toISOString(), incidencia: null });

    if (nota.propiedad_id && !nota.documento_id) {
      const { data: doc } = await supabase
        .from("inmueble_documentos")
        .insert({ propiedad_id: nota.propiedad_id, user_id: user.id, tipo: "nota_simple", nombre: `Nota simple · ${nota.direccion}`.slice(0, 200), path })
        .select("id")
        .single();
      if (doc) cambios.documento_id = doc.id;
    }
  }

  let aviso: string | null = null;
  try {
    const lectura = await leerNotaSimple(bytes);
    if (lectura.resumen) Object.assign(cambios, { resumen: lectura.resumen, resumen_modelo: lectura.modelo, estado: "leida" });
    else aviso = lectura.motivo;
  } catch (e) {
    aviso = `No se ha podido leer automáticamente (${e instanceof Error ? e.message : String(e)}).`;
  }

  const { data, error } = await supabase.from("notas_simples").update(cambios).eq("id", id).select(COLUMNAS_NOTA).single();
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, nota: data, aviso });
}
