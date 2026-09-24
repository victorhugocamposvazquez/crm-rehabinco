import { puntoDeZona } from "@/lib/captacion/portales/zonas";

export type CoordsMapa = { lat: number; lng: number; aprox: boolean };

function num(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Lat/lng guardados en fila Supabase (numeric a veces llega como string). */
export function latLngDeFila(row: Record<string, unknown>): { lat: number | null; lng: number | null } {
  let lat = num(row.lat);
  let lng = num(row.lng);
  if (lat != null && lng != null) return { lat, lng };
  const raw = row.raw;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { lat, lng };
  const rec = raw as Record<string, unknown>;
  lat = lat ?? num(rec.latitude ?? rec.lat);
  lng = lng ?? num(rec.longitude ?? rec.lng ?? rec.lon);
  return { lat, lng };
}

function jitter(id: string, spread = 0.012): { dLat: number; dLng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const a = ((h >>> 0) % 1000) / 1000;
  const b = (((h >>> 10) >>> 0) % 1000) / 1000;
  return { dLat: (a - 0.5) * spread, dLng: (b - 0.5) * spread };
}

/** Coordenadas para el mapa de Captación: exactas o centro de municipio con dispersión. */
export function coordsMapaAnuncio(fila: {
  id: string;
  externo_id: string;
  lat: number | null;
  lng: number | null;
  municipio: string | null;
  zona: string | null;
}): CoordsMapa | null {
  if (fila.lat != null && fila.lng != null) return { lat: fila.lat, lng: fila.lng, aprox: false };
  const id = fila.externo_id || fila.id;
  for (const nombre of [fila.municipio, fila.zona]) {
    if (!nombre) continue;
    const punto = puntoDeZona(nombre);
    if (!punto) continue;
    const { dLat, dLng } = jitter(id);
    return { lat: punto.lat + dLat, lng: punto.lng + dLng, aprox: true };
  }
  return null;
}
