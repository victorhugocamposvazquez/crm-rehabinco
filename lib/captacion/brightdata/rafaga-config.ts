/** Límites de cada ráfaga Unlocker (cron / procesar). */
export const RAFAGA_MAX_PAGINAS = 150;
export const RAFAGA_PARALELO_UNLOCKER = 4;
export const RAFAGA_TOPE_MS = 240_000;
export const RAFAGA_TELEFONO_MAX = 30;
export const RAFAGA_ESPERA_TELEFONO_MS = 2_000;

export type RafagaLimites = {
  limitePaginas: number;
  topeMs: number;
};

export const RAFAGA_LIMITES: RafagaLimites = {
  limitePaginas: RAFAGA_MAX_PAGINAS,
  topeMs: RAFAGA_TOPE_MS,
};

export function rafagaDebeParar(inicioMs: number, ahoraMs: number, procesadas: number, limites: RafagaLimites = RAFAGA_LIMITES): boolean {
  if (procesadas >= limites.limitePaginas) return true;
  return ahoraMs - inicioMs >= limites.topeMs;
}

export function paginasPorMinutoRafaga(paginas: number, duracionMs: number | null | undefined): number | null {
  if (duracionMs == null || duracionMs <= 0 || paginas <= 0) return null;
  return (paginas / duracionMs) * 60_000;
}

export function estimarMinutosVaciarCola(pendientes: number, paginasPorMinuto: number | null): number | null {
  if (pendientes <= 0 || paginasPorMinuto == null || paginasPorMinuto <= 0) return null;
  return pendientes / paginasPorMinuto;
}

export function textoEstimacionCola(minutos: number | null): string | null {
  if (minutos == null || !Number.isFinite(minutos)) return null;
  if (minutos < 1) return "menos de 1 min";
  if (minutos < 120) return `~${Math.ceil(minutos)} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.ceil(minutos % 60);
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`;
}
