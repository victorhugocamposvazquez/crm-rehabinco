import type { InmuebleMedia } from "./catalogo";
import { claveArchivo } from "./archivos-pendientes";
import { esPathExterno, type TipoMediaInmueble } from "./media";
import { sincronizarPortadaEnDb, sincronizarPortadaMemoria } from "./portada";
import { createClient } from "@/lib/supabase/client";
import { subirArchivosMedia } from "./subir-media";

export type FilaMediaRevision =
  | { origen: "guardado"; id: string; media: InmuebleMedia }
  | { origen: "nuevo"; id: string; file: File };

export type RevisionMediaTipo = {
  filas: FilaMediaRevision[];
  borrarIds: Set<string>;
};

export type RevisionMedia = {
  foto: RevisionMediaTipo;
  plano: RevisionMediaTipo;
};

export function revisionVacia(): RevisionMedia {
  return {
    foto: { filas: [], borrarIds: new Set() },
    plano: { filas: [], borrarIds: new Set() },
  };
}

export function revisionDesdeMedia(media: InmuebleMedia[]): RevisionMedia {
  const armar = (tipo: Extract<TipoMediaInmueble, "foto" | "plano">) => {
    const filas = media
      .filter((m) => m.tipo === tipo)
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({ origen: "guardado" as const, id: m.id, media: m }));
    return { filas, borrarIds: new Set<string>() };
  };
  return { foto: armar("foto"), plano: armar("plano") };
}

export function filaNueva(file: File): FilaMediaRevision {
  return { origen: "nuevo", id: `nuevo:${claveArchivo(file)}`, file };
}

export function anadirArchivosRevision(prev: RevisionMediaTipo, files: File[]): RevisionMediaTipo {
  const existentes = new Set(prev.filas.filter((f) => f.origen === "nuevo").map((f) => f.id));
  const extra = files.map(filaNueva).filter((f) => !existentes.has(f.id));
  return { ...prev, filas: [...prev.filas, ...extra] };
}

export function quitarFilaRevision(prev: RevisionMediaTipo, filaId: string): RevisionMediaTipo {
  const fila = prev.filas.find((f) => f.id === filaId);
  if (!fila) return prev;
  const borrarIds = new Set(prev.borrarIds);
  if (fila.origen === "guardado") borrarIds.add(fila.id);
  return { ...prev, filas: prev.filas.filter((f) => f.id !== filaId), borrarIds };
}

export function reordenarFilasRevision(prev: RevisionMediaTipo, desde: number, hasta: number): RevisionMediaTipo {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= prev.filas.length || hasta >= prev.filas.length) {
    return prev;
  }
  const filas = [...prev.filas];
  const [item] = filas.splice(desde, 1);
  filas.splice(hasta, 0, item);
  return { ...prev, filas };
}

function firmaFilas(filas: FilaMediaRevision[]): string {
  return filas.map((f) => (f.origen === "guardado" ? `g:${f.id}` : `n:${f.id}`)).join("|");
}

export function revisionTieneCambios(actual: RevisionMedia, base: RevisionMedia): boolean {
  if (actual.foto.borrarIds.size || actual.plano.borrarIds.size) return true;
  if (firmaFilas(actual.foto.filas) !== firmaFilas(base.foto.filas)) return true;
  if (firmaFilas(actual.plano.filas) !== firmaFilas(base.plano.filas)) return true;
  return false;
}

async function borrarMedia(ids: string[], media: InmuebleMedia[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createClient();
  const porId = new Map(media.map((m) => [m.id, m]));
  for (const id of ids) {
    const item = porId.get(id);
    await supabase.from("inmueble_media").delete().eq("id", id);
    if (item && !esPathExterno(item.path)) {
      await supabase.storage.from("inmuebles").remove([item.path]);
    }
  }
}

export async function aplicarRevisionMedia(input: {
  propiedadId: string;
  userId: string;
  mediaBase: InmuebleMedia[];
  revision: RevisionMedia;
}): Promise<{ media: InmuebleMedia[]; errores: string[] }> {
  const errores: string[] = [];
  let media = [...input.mediaBase];

  const todosBorrar = [...input.revision.foto.borrarIds, ...input.revision.plano.borrarIds];
  await borrarMedia(todosBorrar, media);
  media = media.filter((m) => !todosBorrar.includes(m.id));

  const aplicarTipo = async (tipo: Extract<TipoMediaInmueble, "foto" | "plano">, bloque: RevisionMediaTipo) => {
    const nuevos = bloque.filas.filter((f): f is Extract<FilaMediaRevision, { origen: "nuevo" }> => f.origen === "nuevo");
    const mapNuevo = new Map<string, InmuebleMedia>();
    if (nuevos.length) {
      const antes = media.length;
      const subida = await subirArchivosMedia({
        propiedadId: input.propiedadId,
        userId: input.userId,
        files: nuevos.map((f) => f.file),
        tipo,
        media,
      });
      media = subida.media;
      errores.push(...subida.errores);
      const creados = subida.media.slice(antes);
      nuevos.forEach((fila, idx) => {
        const creado = creados[idx];
        if (creado) mapNuevo.set(fila.id, creado);
      });
    }

    const idsOrdenados = bloque.filas
      .map((f) => (f.origen === "guardado" ? f.id : mapNuevo.get(f.id)?.id))
      .filter(Boolean) as string[];

    if (!idsOrdenados.length) return;

    const supabase = createClient();
    if (tipo === "foto") {
      await supabase.from("inmueble_media").update({ portada: false }).eq("propiedad_id", input.propiedadId);
    }
    await Promise.all(
      idsOrdenados.map((id, orden) => {
        const patch: { orden: number; portada?: boolean } = { orden };
        if (tipo === "foto") patch.portada = orden === 0;
        return supabase.from("inmueble_media").update(patch).eq("id", id);
      })
    );

    const ordenPorId = new Map(idsOrdenados.map((id, orden) => [id, orden]));
    media = media.map((m) => {
      if (m.tipo !== tipo || !ordenPorId.has(m.id)) return m;
      const orden = ordenPorId.get(m.id)!;
      return { ...m, orden, portada: tipo === "foto" ? orden === 0 : m.portada };
    });
  };

  await aplicarTipo("foto", input.revision.foto);
  await aplicarTipo("plano", input.revision.plano);

  await sincronizarPortadaEnDb(input.propiedadId);
  return { media: sincronizarPortadaMemoria(media), errores };
}
