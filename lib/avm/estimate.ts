/**
 * statecrm · AVM · Estimador en vivo y precisión (fase 1)
 *
 * Es el equivalente del `computeEstimate` + pesos de completitud de RealAdvisor,
 * con dos diferencias:
 *   1. Se alimenta desde el primer paso con el €/m² mediano real de la zona
 *      (RealAdvisor solo lo tiene al final).
 *   2. Separa "precisión" (completitud del formulario) de "confianza"
 *      (calidad de la estimación, ver confidence.ts).
 *
 * Es solo el estimador de "mientras rellenas". El valor final lo da el motor
 * de comparables (comparables.ts).
 */
import type { MainType, Twin } from './types';

export interface CountryConfig {
  basePricePerM2: number;   // respaldo cuando no hay mediana de zona
  landPricePerM2: number;
  surfaceField: 'builtSurface' | 'livingSurface';
}

export const COUNTRY_CONFIGS: Record<'es', CountryConfig> = {
  es: { basePricePerM2: 2800, landPricePerM2: 200, surfaceField: 'builtSurface' },
};

export interface LiveEstimate {
  low: number;
  high: number;
  mid: number;
  /** Semianchura relativa del rango, 0..100. Es lo que RealAdvisor llama "uncertainty". */
  uncertainty: number;
  /** De dónde salió el €/m² usado. */
  basis: 'zone_median' | 'country_base';
}

const round = (n: number) => Math.round(n);

/**
 * Rango en vivo. `zoneMedianPpm2` es el €/m² mediano de la zona (market_zone_trend)
 * si ya lo tenemos; si no, se usa la base del país.
 */
export function computeLiveEstimate(twin: Twin, zoneMedianPpm2?: number | null): LiveEstimate {
  const cfg = COUNTRY_CONFIGS.es;
  if (!twin.address?.lat || !twin.address?.lng) {
    return { low: 0, high: 0, mid: 0, uncertainty: 100, basis: 'country_base' };
  }

  const ppm2 = zoneMedianPpm2 ?? cfg.basePricePerM2;
  const basis: LiveEstimate['basis'] = zoneMedianPpm2 ? 'zone_median' : 'country_base';

  // Base: un inmueble "típico" de 100 m²
  let low = round(0.6 * 100 * ppm2);
  let high = round(1.5 * 100 * ppm2);
  let u = zoneMedianPpm2 ? 60 : 70;

  // Tipo
  const typeFactors: Record<MainType, [number, number]> = {
    apartment: [0.7, 0.9],
    house: [1.3, 1.4],
    building: [2.5, 3.5],
    land: [0.3, 0.6],
  };
  if (twin.mainType) {
    const [fl, fh] = typeFactors[twin.mainType];
    low = round(low * fl);
    high = round(high * fh);
    u = Math.min(u, 55);
  }

  // Superficie: el factor que más estrecha
  const surface = twin[cfg.surfaceField] ?? twin.livingSurface ?? twin.builtSurface;
  if (surface && surface > 0) {
    const base = surface * ppm2;
    low = round(0.82 * base);
    high = round(1.22 * base);
    u = 35;
  }

  // Habitaciones (en España usamos dormitorios)
  const rooms = twin.numberOfBedrooms ?? twin.numberOfRooms;
  if (rooms) {
    const f = rooms > 4 ? 1.08 : rooms < 2 ? 0.92 : 1;
    low = round(low * f);
    high = round(high * f);
    u = Math.min(u, 25);
  }

  // Estado
  if (twin.buildingCondition) {
    const f = { 5: 1.15, 4: 1.05, 3: 1, 2: 0.85, 1: 0.7 }[twin.buildingCondition] ?? 1;
    low = round(low * f);
    high = round(high * f);
    u = Math.min(u, 18);
  }

  // Parcela (casas)
  if (twin.landSurface && twin.mainType === 'house') {
    const landValue = twin.landSurface * cfg.landPricePerM2;
    low = round(low + 0.3 * landValue);
    high = round(high + 0.5 * landValue);
    u = Math.max(u - 3, 12);
  }

  if (twin.constructionYear) u = Math.max(u - 2, 10);
  if (twin.numberOfBedrooms) u = Math.max(u - 1, 10);

  if (twin.numberOfIndoorParkings) {
    low += 25_000 * twin.numberOfIndoorParkings;
    high += 40_000 * twin.numberOfIndoorParkings;
    u = Math.max(u - 2, 10);
  }
  if (twin.hasView) {
    low = round(low * 1.05);
    high = round(high * 1.08);
    u = Math.max(u - 1, 10);
  }
  if (twin.hasSwimmingPool) {
    low += 30_000;
    high += 60_000;
    u = Math.max(u - 1, 10);
  }

  return { low, high, mid: round((low + high) / 2), uncertainty: u, basis };
}

/* -------------------------------------------------------------------------- */
/* Precisión: completitud ponderada del twin                                   */
/* -------------------------------------------------------------------------- */

interface Weight {
  key: keyof Twin | 'address';
  weight: number;
  forTypes?: MainType[];
}

export const PRECISION_WEIGHTS: Weight[] = [
  { key: 'address', weight: 20 },
  { key: 'propertyType', weight: 15 },
  { key: 'builtSurface', weight: 15 },
  { key: 'numberOfBedrooms', weight: 10 },
  { key: 'buildingCondition', weight: 10 },
  { key: 'landSurface', weight: 10, forTypes: ['house', 'land', 'building'] },
  { key: 'numberOfResidentialUnits', weight: 8, forTypes: ['building'] },
  { key: 'constructionYear', weight: 5 },
  { key: 'floorOfFlat', weight: 4, forTypes: ['apartment'] },
  { key: 'numberOfBathrooms', weight: 3 },
  { key: 'numberOfIndoorParkings', weight: 3 },
  { key: 'side', weight: 3, forTypes: ['apartment'] },
  { key: 'numberOfOutdoorParkings', weight: 2 },
  { key: 'hasView', weight: 2 },
  { key: 'renovationYear', weight: 2 },
  { key: 'hasSwimmingPool', weight: 1 },
  { key: 'hasElevator', weight: 1, forTypes: ['apartment'] },
  { key: 'balconySurface', weight: 1, forTypes: ['apartment'] },
  { key: 'gardenSurface', weight: 1, forTypes: ['house'] },
];

const isFilled = (twin: Twin, key: Weight['key']) => {
  if (key === 'address') return !!(twin.address?.lat && twin.address?.lng);
  const v = twin[key];
  return v !== null && v !== undefined;
};

/** 0..100: qué parte del peso aplicable está rellena. */
export function computePrecision(twin: Twin): number {
  const applicable = PRECISION_WEIGHTS.filter(
    (w) => !w.forTypes || (twin.mainType && w.forTypes.includes(twin.mainType)),
  );
  const total = applicable.reduce((a, w) => a + w.weight, 0);
  const got = applicable.filter((w) => isFilled(twin, w.key)).reduce((a, w) => a + w.weight, 0);
  return total ? Math.round((got / total) * 100) : 0;
}

/* -------------------------------------------------------------------------- */
/* Formato                                                                     */
/* -------------------------------------------------------------------------- */

export const formatEur = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const formatK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;
