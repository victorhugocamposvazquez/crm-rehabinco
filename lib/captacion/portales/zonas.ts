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

export const CIUDADES_FILTRO = ["A Coruña", "Cambre", "Oleiros", "Culleredo", "Arteixo"] as const;
