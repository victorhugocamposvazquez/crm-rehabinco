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
  return usdBolsilloPeticionesPagadas(pagadas);
}

/** Importe a tarifa Bright Data (1,50 USD / 1.000), sin créditos. */
export function usdValorMercadoPeticiones(peticiones: number): number {
  return usdBolsilloPeticionesPagadas(peticiones);
}

export function usdBolsilloPeticionesPagadas(peticionesPagadas: number): number {
  return Math.round((Math.max(0, peticionesPagadas) / 1000) * UNLOCKER_USD_POR_MIL * 100) / 100;
}

/** Extrapola el gasto acumulado del mes natural UTC al cierre del mes. */
export function usdProyectadoFinMesDesdeGastoAcumulado(gastoAcumulado: number, ahora = new Date()): number {
  if (!Number.isFinite(gastoAcumulado) || gastoAcumulado <= 0) return 0;
  const dia = ahora.getUTCDate();
  const dias = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0)).getUTCDate();
  if (dia <= 0) return gastoAcumulado;
  return Math.round((gastoAcumulado / dia) * dias * 100) / 100;
}
