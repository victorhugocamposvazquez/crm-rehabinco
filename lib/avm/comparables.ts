/**
 * statecrm · AVM · Método de comparables con ajustes (fase 1 → 2)
 *
 * Entrada: el twin, los comparables de avm_comparables() y la estadística de zona.
 * Salida: valor = mediana ponderada recortada de los €/m² ajustados × superficie,
 * menos el descuento oferta → cierre de la zona; rango = P25–P75 ponderado.
 *
 * Solo ajustan atributos PROPIOS del inmueble (superficie, planta y ascensor,
 * exterior, estado, garaje, terraza, año). Los de zona (ruido, transporte…) ya
 * están en los precios de los comparables; entran solo por el hedónico (fase 3).
 *
 * Los factores iniciales son a mano y conservadores; en fase 2 se estiman de la
 * propia base (regresión sobre market_listings) y se guardan en una tabla.
 */
import type { AdjustedComparable, Comparable, Twin, ZoneStats } from './types';

export interface AdjustmentTable {
  /** Elasticidad del €/m² respecto al tamaño: ppm2 ∝ surface^(-k). k=0.12 ⇒ un piso el doble de grande vale ~8 % menos por m². */
  sizeElasticity: number;
  /** Factor por planta (piso sujeto vs comparable), con y sin ascensor. */
  floorWithElevatorPerFloor: number;      // +1 %/planta hasta 6
  floorNoElevatorPerFloor: number;        // −4 %/planta a partir de la 2ª
  groundFloor: number;                    // −8 %
  exteriorVsInterior: number;             // +6 %
  /** Estado: factor por nivel 1..5 relativo al 3 (normal). */
  condition: Record<1 | 2 | 3 | 4 | 5, number>;
  conditionHintToLevel: Record<string, 1 | 2 | 3 | 4 | 5>;
  garage: number;                         // +7 % si el sujeto tiene y el comparable no
  terrace: number;                        // +3 %
  renovatedRecent: number;                // +5 % si reforma < 8 años
  /** Peso por distancia y antigüedad del anuncio. */
  distanceHalfLifeM: number;              // peso = 0.5 a esta distancia
  ageHalfLifeDays: number;
  /** Recorte de colas antes de la mediana ponderada. */
  trimPct: number;                        // 0.1 ⇒ quita 10 % por cada lado
}

export const DEFAULT_ADJUSTMENTS: AdjustmentTable = {
  sizeElasticity: 0.12,
  floorWithElevatorPerFloor: 0.01,
  floorNoElevatorPerFloor: -0.04,
  groundFloor: -0.08,
  exteriorVsInterior: 0.06,
  condition: { 1: 0.70, 2: 0.85, 3: 1.00, 4: 1.06, 5: 1.15 },
  conditionHintToLevel: { reformar: 2, 'buen estado': 3, reformado: 4, nuevo: 5, 'obra nueva': 5 },
  garage: 0.07,
  terrace: 0.03,
  renovatedRecent: 0.05,
  distanceHalfLifeM: 600,
  ageHalfLifeDays: 120,
  trimPct: 0.1,
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function floorFactor(subjectFloor: number | null, compFloor: number | null, hasElevator: boolean | null, t: AdjustmentTable): number {
  if (subjectFloor === null || compFloor === null) return 1;
  const f = (floor: number) => {
    if (floor === 0) return 1 + t.groundFloor;
    if (hasElevator === false) return 1 + t.floorNoElevatorPerFloor * Math.max(0, floor - 1);
    return 1 + t.floorWithElevatorPerFloor * Math.min(floor, 6);
  };
  return f(subjectFloor) / f(compFloor);
}

/** Ajusta el €/m² del comparable para que "parezca" el sujeto. factor > 1 ⇒ el sujeto vale más. */
export function adjustComparable(twin: Twin, c: Comparable, t: AdjustmentTable = DEFAULT_ADJUSTMENTS, today = new Date()): AdjustedComparable {
  const adj: Record<string, number> = {};
  const subjectSurface = twin.builtSurface ?? twin.livingSurface ?? c.surface;

  // Tamaño: €/m² decrece con la superficie
  adj.size = Math.pow(c.surface / subjectSurface, t.sizeElasticity);

  // Planta y ascensor
  adj.floor = floorFactor(twin.floorOfFlat, c.floor, twin.hasElevator ?? c.hasElevator, t);

  // Exterior / interior
  if (twin.side && c.isExterior !== null) {
    const subjExt = twin.side === 'exterior';
    adj.side = subjExt === c.isExterior ? 1 : subjExt ? 1 + t.exteriorVsInterior : 1 / (1 + t.exteriorVsInterior);
  }

  // Estado
  if (twin.buildingCondition) {
    const compLevel = (c.conditionHint && t.conditionHintToLevel[c.conditionHint]) || 3;
    adj.condition = t.condition[twin.buildingCondition] / t.condition[compLevel];
  }

  // Garaje
  if ((twin.numberOfIndoorParkings ?? 0) > 0 !== (c.hasGarage ?? false)) {
    adj.garage = (twin.numberOfIndoorParkings ?? 0) > 0 ? 1 + t.garage : 1 / (1 + t.garage);
  }

  // Terraza / balcón
  if (twin.hasBalcony !== null && c.hasTerrace !== null && twin.hasBalcony !== c.hasTerrace) {
    adj.terrace = twin.hasBalcony ? 1 + t.terrace : 1 / (1 + t.terrace);
  }

  // Reforma reciente
  if (twin.isRenovated && twin.renovationYear && today.getFullYear() - twin.renovationYear < 8) {
    adj.renovated = 1 + t.renovatedRecent;
  }

  const factor = Object.values(adj).reduce((a, b) => a * b, 1);
  const adjustedPpm2 = c.pricePerM2 * clamp(factor, 0.6, 1.6);

  // Peso: distancia × antigüedad del anuncio × similitud de tamaño
  const ageDays = Math.max(0, (today.getTime() - new Date(c.lastSeen).getTime()) / 86_400_000);
  const wDist = Math.pow(0.5, c.distanceM / t.distanceHalfLifeM);
  const wAge = Math.pow(0.5, ageDays / t.ageHalfLifeDays);
  const wSize = 1 - Math.min(0.5, Math.abs(c.surface - subjectSurface) / subjectSurface);
  const weight = +(wDist * wAge * wSize).toFixed(4);

  return { ...c, adjustments: adj, adjustedPpm2: +adjustedPpm2.toFixed(2), weight };
}

/** Percentil ponderado (0..1) sobre valores con peso. */
function weightedPercentile(items: { v: number; w: number }[], p: number): number {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((a, i) => a + i.w, 0);
  let acc = 0;
  for (const i of sorted) {
    acc += i.w;
    if (acc / total >= p) return i.v;
  }
  return sorted[sorted.length - 1]?.v ?? 0;
}

export type RangeMethod = 'iqr' | 'iqr_shrunk';

export interface ComparablesValuation {
  ppm2Mid: number;
  ppm2Low: number;
  ppm2High: number;
  valueMid: number;
  valueLow: number;
  valueHigh: number;
  rangeMethod: RangeMethod;
  used: AdjustedComparable[];
  trimmed: number;
  discountPct: number;
  explanation: string[];
}

function firmaPct(ratio: number): string {
  const n = Math.round(ratio * 100);
  return `${n < 0 ? '−' : '+'}${Math.abs(n)} %`;
}

/**
 * Valor por comparables. `discountPct` = descuento oferta → cierre de la zona (market_discount);
 * si no hay, se usa el del país como respaldo etiquetado.
 */
export function valueFromComparables(
  twin: Twin,
  comparables: Comparable[],
  opts: { discountPct?: number | null; zone?: ZoneStats | null; table?: AdjustmentTable } = {},
): ComparablesValuation | null {
  const t = opts.table ?? DEFAULT_ADJUSTMENTS;
  const surface = twin.builtSurface ?? twin.livingSurface;
  if (!surface || comparables.length === 0) return null;

  const adjusted = comparables.map((c) => adjustComparable(twin, c, t));

  // Recorte de colas por €/m² ajustado
  const sorted = [...adjusted].sort((a, b) => a.adjustedPpm2 - b.adjustedPpm2);
  const cut = Math.floor(sorted.length * t.trimPct);
  const kept = sorted.length - 2 * cut >= 3 ? sorted.slice(cut, sorted.length - cut) : sorted;

  const items = kept.map((c) => ({ v: c.adjustedPpm2, w: c.weight }));
  const ppm2Mid = weightedPercentile(items, 0.5);
  const ppm2Low = weightedPercentile(items, 0.25);
  const ppm2High = weightedPercentile(items, 0.75);

  const discountPct = opts.discountPct ?? 8; // respaldo: 8 % oferta → cierre
  const f = 1 - discountPct / 100;
  const n = kept.length;
  const w = n / (n + 8);
  const rawLow = ppm2Mid > 0 ? ppm2Low / ppm2Mid - 1 : 0;
  const rawHigh = ppm2Mid > 0 ? ppm2High / ppm2Mid - 1 : 0;
  const lowRel = w * rawLow + (1 - w) * -0.08;
  const highRel = w * rawHigh + (1 - w) * 0.08;
  const valueMid = Math.round(surface * ppm2Mid * f);
  const rangeMethod: RangeMethod = n >= 40 ? 'iqr' : 'iqr_shrunk';

  const explanation = [
    `${comparables.length} comparables en ${Math.max(...comparables.map((c) => c.radiusM))} m; ${kept.length} tras recortar colas (${Math.round(t.trimPct * 100)} % por lado).`,
    `€/m² ajustado: mediana ${ppm2Mid.toFixed(0)}, P25 ${ppm2Low.toFixed(0)}, P75 ${ppm2High.toFixed(0)}.`,
    `Superficie ${surface} m² × ${ppm2Mid.toFixed(0)} €/m² = ${Math.round(surface * ppm2Mid).toLocaleString('es-ES')} € de oferta.`,
    `Descuento oferta → cierre ${discountPct} % (${opts.discountPct != null ? 'calibrado en la zona' : 'valor por defecto'}).`,
    `Rango: P25–P75 de los comparables (${firmaPct(rawLow)} / ${firmaPct(rawHigh)}) amortiguado hacia ±8 % por tener ${n} comparables → ${firmaPct(lowRel)} / ${firmaPct(highRel)}`,
  ];
  if (opts.zone) explanation.push(`Mediana de zona (${opts.zone.label}): ${opts.zone.medianPpm2} €/m², ${opts.zone.n} anuncios.`);

  return {
    ppm2Mid, ppm2Low, ppm2High,
    valueMid,
    valueLow: Math.round(valueMid * (1 + lowRel)),
    valueHigh: Math.round(valueMid * (1 + highRel)),
    rangeMethod,
    used: kept,
    trimmed: adjusted.length - kept.length,
    discountPct,
    explanation,
  };
}

/** Mediana ponderada recortada del €/m² ajustado, sin descuento de cierre. Sirve para el alquiler. */
export function medianaAjustadaPpm2(twin: Twin, comparables: Comparable[], table: AdjustmentTable = DEFAULT_ADJUSTMENTS): number | null {
  const surface = twin.builtSurface ?? twin.livingSurface;
  if (!surface || comparables.length === 0) return null;
  const adjusted = comparables.map((c) => adjustComparable(twin, c, table));
  const sorted = [...adjusted].sort((a, b) => a.adjustedPpm2 - b.adjustedPpm2);
  const cut = Math.floor(sorted.length * table.trimPct);
  const kept = sorted.length - 2 * cut >= 3 ? sorted.slice(cut, sorted.length - cut) : sorted;
  return weightedPercentile(kept.map((c) => ({ v: c.adjustedPpm2, w: c.weight })), 0.5);
}

/** Alquiler fase 1: valor × rentabilidad bruta de la zona (calculada de los anuncios de alquiler). */
export function rentFromYield(valueMid: number, grossYieldPct: number): { rentMonthly: number; grossYield: number } {
  return { rentMonthly: Math.round((valueMid * grossYieldPct) / 100 / 12 / 10) * 10, grossYield: grossYieldPct };
}
