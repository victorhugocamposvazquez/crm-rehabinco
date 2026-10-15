import { createClient } from "@/lib/supabase/client";
import type { InmuebleMedia } from "./catalogo";

type FotoOrdenable = {
  id?: string;
  url?: string;
  tipo?: string | null;
  orden?: number | null;
  portada?: boolean | null;
};

export function fotosOrdenadas<T extends FotoOrdenable>(media: T[]): T[] {
  return media
    .filter((m) => !m.tipo || m.tipo === "foto")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

export function urlPortadaDeMedia(media: FotoOrdenable[] | null | undefined): string | null {
  return fotosOrdenadas(media ?? [])[0]?.url ?? null;
}

export function idPortadaDeMedia(media: FotoOrdenable[]): string | null {
  const primera = fotosOrdenadas(media)[0];
  return primera?.id ?? null;
}

/** La portada es siempre la de menor orden (posición 0). */
export function sincronizarPortadaMemoria<T extends InmuebleMedia>(media: T[]): T[] {
  const primeraId = idPortadaDeMedia(media);
  if (!primeraId) {
    return media.map((m) => (m.tipo === "foto" ? { ...m, portada: false } : m));
  }
  return media.map((m) => (m.tipo === "foto" ? { ...m, portada: m.id === primeraId } : m));
}

export async function sincronizarPortadaEnDb(propiedadId: string): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase
    .from("inmueble_media")
    .select("id")
    .eq("propiedad_id", propiedadId)
    .eq("tipo", "foto")
    .order("orden", { ascending: true })
    .limit(1);
  const primera = data?.[0]?.id;
  if (!primera) return;
  await supabase.from("inmueble_media").update({ portada: false }).eq("propiedad_id", propiedadId).eq("tipo", "foto");
  await supabase.from("inmueble_media").update({ portada: true }).eq("id", primera);
}
