/** Bright Data Web Unlocker: ~1,50 USD / 1.000 peticiones con éxito. */
export const UNLOCKER_USD_POR_MIL = 1.5;

export function creditosGratisMes(): number {
  const n = Number(process.env.CAPTACION_UNLOCKER_CREDITOS_GRATIS ?? 5000);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5000;
}

export function usdPresupuestoMes(): number {
  const n = Number(process.env.CAPTACION_UNLOCKER_USD_MES ?? 10);
  return Number.isFinite(n) && n >= 0 ? n : 10;
}

/** Peticiones Unlocker al mes: créditos gratis + tramo pagado con el USD configurado. */
export function topePeticionesMensual(): number {
  const fijo = process.env.CAPTACION_UNLOCKER_TOPE_MES?.trim();
  if (fijo) {
    const n = Number(fijo);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  const extra = Math.floor((usdPresupuestoMes() / UNLOCKER_USD_POR_MIL) * 1000);
  return creditosGratisMes() + extra;
}

/** USD de bolsillo si estas peticiones fueran lo único del mes (tras créditos gratis). */
export function usdEstimadoTrasCreditos(peticiones: number, creditosGratis = creditosGratisMes()): number {
  const pagadas = Math.max(0, peticiones - creditosGratis);
  return Math.round((pagadas / 1000) * UNLOCKER_USD_POR_MIL * 100) / 100;
}
