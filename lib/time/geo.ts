import type { PunchMode, WorkCenter } from "./types";

const R_EARTH_M = 6_371_000;

export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type ModalidadSugerida = {
  mode: PunchMode;
  workCenter: WorkCenter | null;
  distanceM: number | null;
};

/** OFFICE si la posición cae en el radio de algún centro; si no, REMOTE. */
export function sugerirModalidad(
  lat: number | null | undefined,
  lng: number | null | undefined,
  centros: WorkCenter[],
  ultimoMode?: PunchMode | null
): ModalidadSugerida {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { mode: ultimoMode ?? "office", workCenter: null, distanceM: null };
  }
  let best: { center: WorkCenter; d: number } | null = null;
  for (const c of centros) {
    if (!c) continue;
    const d = distanciaMetros(lat, lng, c.lat, c.lng);
    if (d <= c.radius_m && (!best || d < best.d)) best = { center: c, d };
  }
  if (best) {
    return { mode: "office", workCenter: best.center, distanceM: best.d };
  }
  return { mode: "remote", workCenter: null, distanceM: null };
}
