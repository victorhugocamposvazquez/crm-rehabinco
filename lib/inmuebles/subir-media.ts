import { createClient } from "@/lib/supabase/client";
import type { InmuebleMedia } from "./catalogo";
import { validarArchivoMedia, type TipoMediaInmueble } from "./media";

const SELECT_MEDIA = "id, propiedad_id, tipo, path, url, orden, portada";

export async function subirArchivosMedia(input: {
  propiedadId: string;
  userId: string;
  files: File[];
  tipo: TipoMediaInmueble;
  media: InmuebleMedia[];
}): Promise<{ media: InmuebleMedia[]; errores: string[] }> {
  const supabase = createClient();
  const next = [...input.media];
  const errores: string[] = [];
  for (const file of input.files) {
    const fallo = validarArchivoMedia(input.tipo, file);
    if (fallo) {
      errores.push(fallo);
      continue;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || (input.tipo === "plano" ? "pdf" : "jpg");
    const path = `${input.propiedadId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("inmuebles").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (upErr) {
      errores.push(upErr.message);
      continue;
    }
    const { data: pub } = supabase.storage.from("inmuebles").getPublicUrl(path);
    const delTipo = next.filter((m) => m.tipo === input.tipo);
    const portada = input.tipo === "foto" && delTipo.length === 0;
    const { data, error } = await supabase
      .from("inmueble_media")
      .insert({
        propiedad_id: input.propiedadId,
        user_id: input.userId,
        tipo: input.tipo,
        path,
        url: pub.publicUrl,
        orden: delTipo.length,
        portada,
      })
      .select(SELECT_MEDIA)
      .single();
    if (error || !data) {
      errores.push(error?.message ?? "No se ha podido guardar el archivo.");
      continue;
    }
    next.push(data as InmuebleMedia);
  }
  return { media: next, errores };
}
