import { createClient } from "@/lib/supabase/client";
import { SELECT_INMUEBLE_MEDIA, comoMedia } from "./archivo";
import type { InmuebleMedia } from "./catalogo";
import { sincronizarPortadaEnDb, sincronizarPortadaMemoria } from "./portada";

export async function usarRetoqueEnAnuncio(input: {
  propiedadId: string;
  userId: string;
  retoque: InmuebleMedia;
  media: InmuebleMedia[];
}): Promise<{ media: InmuebleMedia[]; error: string | null }> {
  if (input.retoque.tipo !== "retocada") {
    return { media: input.media, error: "Elige una foto retocada." };
  }
  const supabase = createClient();
  const ext = input.retoque.path.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${input.propiedadId}/${crypto.randomUUID()}.${ext}`;
  const copia = await supabase.storage.from("inmuebles").copy(input.retoque.path, path);
  if (copia.error) return { media: input.media, error: copia.error.message };

  const fotos = input.media.filter((m) => m.tipo === "foto");
  const publica = supabase.storage.from("inmuebles").getPublicUrl(path);
  const { data, error } = await supabase
    .from("inmueble_media")
    .insert({
      propiedad_id: input.propiedadId,
      user_id: input.userId,
      tipo: "foto",
      path,
      url: publica.publicUrl,
      orden: fotos.length,
      portada: false,
      origen_id: input.retoque.id,
      retoque: input.retoque.retoque ?? null,
    })
    .select(SELECT_INMUEBLE_MEDIA)
    .single();
  if (error || !data) {
    await supabase.storage.from("inmuebles").remove([path]);
    return { media: input.media, error: error?.message ?? "No se ha podido pasar la foto al anuncio." };
  }
  await sincronizarPortadaEnDb(input.propiedadId);
  return { media: sincronizarPortadaMemoria([...input.media, comoMedia(data)]), error: null };
}

export async function quitarArchivoMedia(item: InmuebleMedia, media: InmuebleMedia[]): Promise<InmuebleMedia[]> {
  const supabase = createClient();
  await supabase.from("inmueble_media").delete().eq("id", item.id);
  if (item.path && !item.path.startsWith("externo/")) {
    await supabase.storage.from("inmuebles").remove([item.path]);
  }
  return media.filter((m) => m.id !== item.id);
}
