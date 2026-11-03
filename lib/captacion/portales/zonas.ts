export type PuntoZona = { lat: number; lng: number; radio: number };

const ZONAS: Record<string, PuntoZona> = {
  "a coruña": { lat: 43.3623, lng: -8.4115, radio: 8000 },
  coruna: { lat: 43.3623, lng: -8.4115, radio: 8000 },
  coruña: { lat: 43.3623, lng: -8.4115, radio: 8000 },
  cambre: { lat: 43.2944, lng: -8.3472, radio: 6000 },
  oleiros: { lat: 43.3334, lng: -8.3139, radio: 6000 },
  culleredo: { lat: 43.2878, lng: -8.3894, radio: 6000 },
  arteixo: { lat: 43.3044, lng: -8.5113, radio: 7000 },
  sada: { lat: 43.3508, lng: -8.2542, radio: 5000 },
};

function claveZona(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^a\s+/, "");
}

export function puntoDeZona(nombre: string): PuntoZona | null {
  const clave = claveZona(nombre);
  return ZONAS[clave] ?? ZONAS[nombre.trim().toLowerCase()] ?? null;
}

export function centroDeZonas(
  zonas: string[],
  fijo?: { lat?: number | null; lng?: number | null; radio?: number | null }
): PuntoZona | null {
  if (fijo?.lat != null && fijo.lng != null) {
    return { lat: fijo.lat, lng: fijo.lng, radio: fijo.radio ?? 15000 };
  }
  const puntos = zonas.map(puntoDeZona).filter((p): p is PuntoZona => Boolean(p));
  if (puntos.length === 0) return null;
  const lat = puntos.reduce((s, p) => s + p.lat, 0) / puntos.length;
  const lng = puntos.reduce((s, p) => s + p.lng, 0) / puntos.length;
  const radio = Math.max(...puntos.map((p) => p.radio));
  return { lat, lng, radio };
}

export const CIUDADES_FILTRO = ["A Coruña", "Cambre", "Oleiros", "Culleredo", "Arteixo", "Madrid"] as const;

/** Barrios de Moncloa y el municipio de al lado. Pozuelo no cuelga de Madrid. */
export const LOCALIDADES_FILTRO = [
  "Aravaca",
  "Valdemarín",
  "El Plantío",
  "Casa de Campo",
  "Ciudad Universitaria",
  "Valdezarza",
  "Argüelles",
  "Pozuelo de Alarcón",
] as const;

function sinAcento(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Localidades del desplegable según la ciudad elegida.
 * El catálogo fijo (Aravaca, etc.) solo aplica a Madrid / «todas».
 * Otras ciudades no reutilizan ese listado.
 */
export function localidadesParaCiudad(ciudad: string): readonly string[] {
  const clave = sinAcento(ciudad);
  if (!clave || clave === "todas" || clave === "madrid") return LOCALIDADES_FILTRO;
  return [];
}

/** Barrios distintos del municipio en los anuncios (p. ej. Cambre). */
export function localidadesDesdeAnuncios(
  ciudad: string,
  anuncios: Array<{ zona?: string | null; municipio?: string | null }>
): string[] {
  const claveCiudad = sinAcento(ciudad);
  if (!claveCiudad || claveCiudad === "todas") return [];
  const vistas = new Set<string>();
  for (const a of anuncios) {
    const mun = sinAcento(a.municipio ?? "");
    if (!mun.startsWith(claveCiudad)) continue;
    const zona = (a.zona ?? "").trim();
    if (!zona) continue;
    if (sinAcento(zona) === claveCiudad || sinAcento(zona).startsWith(claveCiudad)) continue;
    vistas.add(zona);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, "es"));
}

export function opcionesLocalidadFiltro(
  ciudad: string,
  anuncios: Array<{ zona?: string | null; municipio?: string | null }> = []
): string[] {
  const catalogo = localidadesParaCiudad(ciudad);
  if (catalogo.length > 0) return [...catalogo];
  return localidadesDesdeAnuncios(ciudad, anuncios);
}

/** La localidad casa con el barrio o, si es un municipio, con el municipio del anuncio. */
export function anuncioEnLocalidad(
  localidad: string,
  anuncio: { zona?: string | null; municipio?: string | null }
): boolean {
  const clave = sinAcento(localidad);
  if (!clave || clave === "todas") return true;
  const zona = sinAcento(anuncio.zona ?? "");
  const municipio = sinAcento(anuncio.municipio ?? "");
  if (clave.startsWith("pozuelo")) return municipio.startsWith("pozuelo") || zona.startsWith("pozuelo");
  return zona === clave || municipio === clave;
}
