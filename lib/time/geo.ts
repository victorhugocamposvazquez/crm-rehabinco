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

/**
 * OFFICE si la posición cae en el radio de algún centro (ampliado con la
 * precisión GPS, tope 120 m: dentro de un edificio el error suele ser alto).
 * Si no hay coords, conserva la última modalidad o asume oficina.
 */
export function sugerirModalidad(
  lat: number | null | undefined,
  lng: number | null | undefined,
  centros: WorkCenter[],
  ultimoMode?: PunchMode | null,
  accuracyM?: number | null
): ModalidadSugerida {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { mode: ultimoMode ?? "office", workCenter: null, distanceM: null };
  }
  const margenGps =
    accuracyM != null && Number.isFinite(accuracyM) ? Math.min(Math.max(0, accuracyM), 120) : 40;
  let best: { center: WorkCenter; d: number } | null = null;
  let nearest: { center: WorkCenter; d: number } | null = null;
  for (const c of centros) {
    if (!c) continue;
    const d = distanciaMetros(lat, lng, c.lat, c.lng);
    if (!nearest || d < nearest.d) nearest = { center: c, d };
    if (d <= c.radius_m + margenGps && (!best || d < best.d)) best = { center: c, d };
  }
  if (best) {
    return { mode: "office", workCenter: best.center, distanceM: best.d };
  }
  return {
    mode: "remote",
    workCenter: null,
    distanceM: nearest?.d ?? null,
  };
}
