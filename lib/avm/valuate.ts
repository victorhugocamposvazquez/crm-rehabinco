/**
 * statecrm · AVM · Orquestador `valuate()` (fase 1)
 *
 * Un solo punto de entrada para las dos puertas (CRM y landing). Cada capa
 * se resuelve con una cadena de respaldo y deja constancia en `sourcesUsed`.
 * Las dependencias (Supabase, geocodificación, Catastro) se inyectan para
 * poder probarlo sin red.
 */
import { computeLiveEstimate, computePrecision } from './estimate';
import { computeConfidence } from './confidence';
import { medianaAjustadaPpm2, rentFromYield, valueFromComparables } from './comparables';
import type {
  Channel, Comparable, Environment, Operation, SourceUsed, Twin, ValuationResult, ZoneStats,
} from './types';

export interface ValuateDeps {
  /** market_zone_trend para el punto; null si no hay datos. */
  zoneStats: (twin: Twin, op: Operation) => Promise<ZoneStats | null>;
  /** Respaldo: informes públicos de portales / serie oficial; null si no hay. */
  zoneStatsFallback?: (twin: Twin, op: Operation) => Promise<ZoneStats | null>;
  /** avm_comparables(); [] si no hay. */
  comparables: (twin: Twin, op: Operation) => Promise<Comparable[]>;
  /** avm_comparables(..., 'rent'). Si no se inyecta, el alquiler no usa comparables. */
  rentComparables?: (twin: Twin) => Promise<Comparable[]>;
  /** market_discount para la zona; null si no hay calibración. */
  discountPct?: (twin: Twin) => Promise<number | null>;
  /** Rentabilidad bruta de la zona (anuncios de alquiler / venta); null si no hay. */
  grossYieldPct?: (twin: Twin) => Promise<number | null>;
  /** avm_environment() + reglas; null si la capa no está cargada. */
  environment?: (twin: Twin) => Promise<Environment | null>;
}

export interface ValuateOptions {
  channel: Channel;
  operation?: Operation;
  /** Campos que vinieron de Catastro/anuncio (para sourcesUsed.property). */
  propertySource?: 'catastro_local' | 'catastro_sede' | 'catastro_live' | 'listing' | 'manual';
  /** true solo cuando se sirvió la caché caducada de la Sede. */
  propertyStale?: boolean;
  geocodingSource?: 'google' | 'cartociudad' | 'postcode_centroid' | 'catastro' | 'pin' | 'listing' | 'missing';
  /** Sin anuncios aún en un municipio recién onboarded. */
  marketLoading?: boolean;
  marketLoadingMessage?: string | null;
}

export const METHOD_VERSION = 'comparables-1.1';

export async function valuate(twin: Twin, deps: ValuateDeps, opts: ValuateOptions): Promise<ValuationResult> {
  const op = opts.operation ?? 'sale';
  const sources: SourceUsed[] = [];
  const explanation: string[] = [];

  // Geocodificación y datos del inmueble: ya resueltos aguas arriba; aquí solo se anotan.
  const geo = opts.geocodingSource ?? 'google';
  const geoStatus: SourceUsed['status'] =
    geo === 'missing' ? 'missing'
    : geo === 'postcode_centroid' ? 'degraded'
    : geo === 'cartociudad' ? 'fallback'
    : 'primary';
  sources.push({ layer: 'geocoding', source: geo, status: geoStatus });
  const catastroPrimario = opts.propertySource === 'catastro_local' || opts.propertySource === 'catastro_sede';
  const propStatus: SourceUsed['status'] =
    opts.propertyStale ? 'fallback'
    : catastroPrimario ? 'primary'
    : opts.propertySource === 'catastro_live' || opts.propertySource === 'listing' ? 'fallback'
    : (twin.builtSurface && twin.constructionYear) ? 'degraded' : 'missing';
  sources.push({ layer: 'property', source: opts.propertySource ?? 'manual', status: propStatus });

  // Mercado de zona
  let zone = await deps.zoneStats(twin, op);
  if (zone) {
    sources.push({ layer: 'market', source: `market_listings/${zone.zoneLevel}`, status: zone.zoneLevel === 'census_section' || zone.zoneLevel === 'postcode' ? 'primary' : 'fallback' });
  } else if (deps.zoneStatsFallback && (zone = await deps.zoneStatsFallback(twin, op))) {
    sources.push({ layer: 'market', source: zone.source, status: 'degraded' });
  } else {
    sources.push({ layer: 'market', source: 'country_base', status: 'missing' });
  }

  // Comparables
  const comps = await deps.comparables(twin, op);
  const discount = (await deps.discountPct?.(twin)) ?? null;
  sources.push({ layer: 'close_series', source: discount != null ? 'market_discount' : 'default_8pct', status: discount != null ? 'primary' : 'degraded' });

  const byComps = valueFromComparables(twin, comps, { discountPct: discount, zone });
  const precisionScore = computePrecision(twin);

  let valueMid: number, valueLow: number, valueHigh: number, pricePerM2: number | null = null;
  let rangeMethod: ValuationResult['rangeMethod'] = null;
  if (byComps && comps.length >= 3) {
    const maxRadius = Math.max(...comps.map((c) => c.radiusM));
    sources.push({ layer: 'comparables', source: `avm_comparables/${maxRadius}m`, status: comps.length >= 8 && maxRadius <= 1500 ? 'primary' : 'fallback' });
    valueMid = byComps.valueMid; valueLow = byComps.valueLow; valueHigh = byComps.valueHigh;
    pricePerM2 = byComps.ppm2Mid;
    rangeMethod = byComps.rangeMethod;
    explanation.push(...byComps.explanation);
  } else {
    // Sin comparables: estimador en vivo con la mediana de zona
    sources.push({ layer: 'comparables', source: 'none', status: 'missing' });
    const live = computeLiveEstimate(twin, zone?.medianPpm2 ?? null);
    valueMid = live.mid; valueLow = live.low; valueHigh = live.high;
    const surface = twin.builtSurface ?? twin.livingSurface;
    pricePerM2 = surface ? Math.round(valueMid / surface) : null;
    explanation.push(`Sin comparables suficientes: estimación por €/m² de zona (${live.basis}) × superficie.`);
  }

  const surface = twin.builtSurface ?? twin.livingSurface;
  const redondear10 = (n: number) => Math.round(n / 10) * 10;
  let rentMonthly: number | null = null;
  let rentSource: ValuationResult['rentSource'] = null;
  let rentStatus: SourceUsed['status'] = 'missing';
  let rentLayerSource = 'none';
  const alquileres = (await deps.rentComparables?.(twin)) ?? [];
  const cerca = alquileres.filter((c) => c.radiusM <= 1500);
  const ppm2Alquiler = cerca.length >= 6 ? medianaAjustadaPpm2(twin, cerca) : null;
  if (ppm2Alquiler != null && surface) {
    rentMonthly = redondear10(surface * ppm2Alquiler);
    rentSource = 'comparables';
    rentStatus = 'primary';
    rentLayerSource = 'avm_comparables/rent';
    explanation.push(`Alquiler: mediana de ${cerca.length} comparables de alquiler a ≤ 1.500 m × ${surface} m² ≈ ${rentMonthly.toLocaleString('es-ES')} €/mes.`);
  } else {
    const zonaAlquiler = await deps.zoneStats(twin, 'rent');
    const sujeto = byComps?.ppm2Mid ?? (surface ? valueMid / surface : null);
    if (surface && zonaAlquiler?.medianPpm2 && zone?.medianPpm2 && sujeto) {
      const factor = Math.min(1.2, Math.max(0.8, sujeto / zone.medianPpm2));
      rentMonthly = redondear10(surface * zonaAlquiler.medianPpm2 * factor);
      rentSource = 'zone_adjusted';
      rentStatus = 'fallback';
      rentLayerSource = `zone/${zonaAlquiler.zoneLevel}`;
      explanation.push(`Alquiler: ${surface} m² × ${zonaAlquiler.medianPpm2} €/m²/mes de la zona × ${factor.toFixed(2)} (el sujeto frente a la mediana de venta) ≈ ${rentMonthly.toLocaleString('es-ES')} €/mes.`);
    } else {
      const gy = (await deps.grossYieldPct?.(twin)) ?? null;
      if (gy != null && valueMid) {
        rentMonthly = rentFromYield(valueMid, gy).rentMonthly;
        rentSource = 'yield';
        rentStatus = 'degraded';
        rentLayerSource = 'gross_yield';
        explanation.push(`Alquiler: ${valueMid.toLocaleString('es-ES')} € × ${gy} % / 12 ≈ ${rentMonthly.toLocaleString('es-ES')} €/mes.`);
      }
    }
  }
  const grossYield = rentMonthly && valueMid ? +((rentMonthly * 12 / valueMid) * 100).toFixed(2) : null;
  sources.push({ layer: 'rent', source: rentLayerSource, status: rentStatus });

  // Entorno (informativo en fase 1; no toca el precio)
  const environment = (await deps.environment?.(twin)) ?? null;
  sources.push({ layer: 'environment', source: environment ? 'environment_layers' : 'none', status: environment ? 'primary' : 'missing' });

  if (opts.marketLoadingMessage) {
    explanation.unshift(opts.marketLoadingMessage);
  }

  const { confidence, penalties } = computeConfidence({
    sourcesUsed: sources,
    comparables: byComps?.used ?? [],
    precisionScore,
    trend12mPct: zone?.trend12mPct ?? null,
    marketLoading: opts.marketLoading,
  });
  if (penalties.length) explanation.push(`Confianza ${confidence} %: ` + penalties.map((p) => `${p.reason} (−${p.points})`).join('; ') + '.');

  return {
    methodVersion: METHOD_VERSION,
    operation: op,
    valueMid, valueLow, valueHigh, pricePerM2,
    rentMonthly,
    rentSource,
    rangeMethod,
    grossYield,
    confidence,
    precisionScore,
    sourcesUsed: sources,
    comparables: byComps?.used ?? [],
    zoneStats: zone,
    environment,
    explanation,
  };
}

/** Vista recortada para la landing pública. */
export function publicView(r: ValuationResult) {
  return {
    valueMid: r.valueMid,
    valueLow: r.valueLow,
    valueHigh: r.valueHigh,
    pricePerM2: r.pricePerM2,
    rentMonthly: r.rentMonthly,
    grossYield: r.grossYield,
    precision: r.confidence,                 // al propietario se le llama "precisión"
    zone: r.zoneStats ? { label: r.zoneStats.label, medianPpm2: r.zoneStats.medianPpm2, n: r.zoneStats.n, trend12mPct: r.zoneStats.trend12mPct } : null,
    environment: r.environment
      ? { positives: r.environment.positives, negatives: r.environment.negatives, flags: r.environment.flags }
      : null,
    comparablesCount: r.comparables.length, // sin la lista
  };
}
