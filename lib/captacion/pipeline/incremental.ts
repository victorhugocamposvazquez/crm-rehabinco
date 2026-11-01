import { zonaAlGuardar } from "@/lib/captacion/brightdata/lugar-idealista";
import { hashContenidoAnuncio, type AnuncioGuardado } from "@/lib/captacion/pipeline/upsert";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";

export type PrevioIncremental = AnuncioGuardado & {
  anunciante?: string | null;
  superficie?: number | null;
  habitaciones?: number | null;
  banos?: number | null;
  planta?: string | null;
  tipo?: string | null;
  operacion?: string | null;
};

function mismoNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

function mismoStr(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Campos que el listado a menudo no trae (o trae peores que la ficha).
 * Si el entrante viene vacío, no se interpreta como borrado.
 */
function cambioSiPresente(
  previo: string | null | undefined,
  entrante: string | null | undefined
): boolean {
  if (entrante == null || entrante === "") return false;
  return !mismoStr(previo, entrante);
}

function cambioNumSiPresente(
  previo: number | null | undefined,
  entrante: number | null | undefined
): boolean {
  if (entrante == null) return false;
  return !mismoNum(previo, entrante);
}

/** Rellena huecos del listado con el previo para comparar hash (no interpreta null como borrado). */
export function entranteEfectivoParaComparar(
  previo: PrevioIncremental,
  entrante: AnuncioEntrante
): AnuncioEntrante {
  return {
    ...entrante,
    titulo: entrante.titulo || previo.titulo || entrante.titulo,
    descripcion: entrante.descripcion ?? previo.descripcion ?? null,
    precio: entrante.precio ?? previo.precio ?? null,
    superficie: entrante.superficie ?? previo.superficie ?? null,
    habitaciones: entrante.habitaciones ?? previo.habitaciones ?? null,
  };
}

/**
 * True si el anuncio ya existe, no era retirado y no cambió nada relevante
 * para captación / demandas (precio, attrs, contacto, ubicación, tipo…).
 * En ese caso basta un touch ligero (visto_en) sin historial, dedup, score ni AVM.
 */
export function anuncioSinCambiosRelevantes(
  previo: PrevioIncremental | null | undefined,
  entrante: AnuncioEntrante
): boolean {
  if (!previo) return false;
  if (previo.desaparecido_en) return false;

  const efectivo = entranteEfectivoParaComparar(previo, entrante);
  const hashNuevo = hashContenidoAnuncio(efectivo);
  if (!previo.hash_contenido || previo.hash_contenido !== hashNuevo) return false;

  // Teléfono/nombre: misma semántica que upsert (null entrante conserva el previo).
  const telefono = entrante.contacto_telefono ?? previo.contacto_telefono ?? null;
  const nombre = entrante.contacto_nombre ?? previo.contacto_nombre ?? null;
  if (!mismoStr(previo.contacto_telefono, telefono)) return false;
  if (!mismoStr(previo.contacto_nombre, nombre)) return false;

  if (cambioNumSiPresente(previo.precio, entrante.precio)) return false;
  if (cambioSiPresente(previo.titulo, entrante.titulo)) return false;
  if (cambioSiPresente(previo.descripcion, entrante.descripcion)) return false;
  if (cambioSiPresente(previo.anunciante, entrante.anunciante)) return false;
  if (cambioSiPresente(previo.municipio, entrante.municipio)) return false;
  if (cambioSiPresente(previo.tipo, entrante.tipo)) return false;
  if (cambioSiPresente(previo.operacion, entrante.operacion)) return false;
  if (cambioSiPresente(previo.planta, entrante.planta)) return false;

  if (cambioNumSiPresente(previo.superficie, entrante.superficie)) return false;
  if (cambioNumSiPresente(previo.habitaciones, entrante.habitaciones)) return false;
  if (cambioNumSiPresente(previo.banos, entrante.banos)) return false;

  if (cambioNumSiPresente(previo.lat, entrante.lat)) return false;
  if (cambioNumSiPresente(previo.lng, entrante.lng)) return false;

  if (entrante.zona != null && entrante.zona !== "") {
    const zonaEfectiva = zonaAlGuardar(entrante.zona, entrante.municipio ?? previo.municipio, previo.zona);
    if (!mismoStr(previo.zona, zonaEfectiva)) return false;
  }

  return true;
}
