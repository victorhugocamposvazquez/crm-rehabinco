import { ZONA_PROVINCIA_48H } from "@/lib/captacion/brightdata/zonas";

/** Sondeo de novedades (filtro provincia 48 h), no pasada completa. */
export const SONDEO_NOVEDADES_CADA_MIN = 15;

/** Páginas Unlocker estimadas por sondeo (listado provincia 48 h). */
export const SONDEO_NOVEDADES_PAGINAS = 2;

export function sondeosNovedadesPorDia(cadaMin = SONDEO_NOVEDADES_CADA_MIN): number {
  if (!Number.isFinite(cadaMin) || cadaMin <= 0) return 0;
  return Math.floor((24 * 60) / cadaMin);
}

/** Recogida que solo mira el filtro provincia 48 h: no sirve para retirados. */
export function esRecogidaSoloNovedades(zonas: string[] | null | undefined): boolean {
  const lista = zonas ?? [];
  return lista.length === 1 && lista[0] === ZONA_PROVINCIA_48H;
}
