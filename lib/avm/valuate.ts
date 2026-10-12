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
import { rentFromYield, valueFromComparables } from './comparables';
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
  propertySource?: 'catastro_local' | 'catastro_live' | 'listing' | 'manual';
  geocodingSource?: 'google' | 'cartociudad' | 'postcode_centroid' | 'catastro' | 'pin' | 'listing' | 'missing';
}

export const METHOD_VERSION = 'comparables-1.0';

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
  const propStatus: SourceUsed['status'] =
    opts.propertySource === 'catastro_local' ? 'primary'
    : opts.propertySource === 'catastro_live' ? 'fallback'
    : opts.propertySource === 'listing' ? 'fallback'
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
  if (byComps && comps.length >= 3) {
    const maxRadius = Math.max(...comps.map((c) => c.radiusM));
    sources.push({ layer: 'comparables', source: `avm_comparables/${maxRadius}m`, status: comps.length >= 8 && maxRadius <= 1500 ? 'primary' : 'fallback' });
    valueMid = byComps.valueMid; valueLow = byComps.valueLow; valueHigh = byComps.valueHigh;
    pricePerM2 = byComps.ppm2Mid;
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

  // Alquiler (fase 1)
  const gy = (await deps.grossYieldPct?.(twin)) ?? null;
  const rent = gy ? rentFromYield(valueMid, gy) : null;
  if (rent) explanation.push(`Alquiler: ${valueMid.toLocaleString('es-ES')} € × ${gy} % / 12 ≈ ${rent.rentMonthly} €/mes.`);

  // Entorno (informativo en fase 1; no toca el precio)
  const environment = (await deps.environment?.(twin)) ?? null;
  sources.push({ layer: 'environment', source: environment ? 'environment_layers' : 'none', status: environment ? 'primary' : 'missing' });

  const { confidence, penalties } = computeConfidence({ sourcesUsed: sources, comparables: byComps?.used ?? [], precisionScore });
  if (penalties.length) explanation.push(`Confianza ${confidence} %: ` + penalties.map((p) => `${p.reason} (−${p.points})`).join('; ') + '.');

  return {
    methodVersion: METHOD_VERSION,
    operation: op,
    valueMid, valueLow, valueHigh, pricePerM2,
    rentMonthly: rent?.rentMonthly ?? null,
    grossYield: rent?.grossYield ?? null,
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
    environment: r.environment ? { score: r.environment.score, positives: r.environment.positives, negatives: r.environment.negatives } : null,
    comparablesCount: r.comparables.length, // sin la lista
  };
}
