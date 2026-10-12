/**
 * statecrm · AVM · Confianza (fase 1)
 *
 * Distinta de la "precisión" (completitud del formulario). La confianza mide
 * la calidad de la estimación y baja cuando falta una fuente, hay pocos
 * comparables o están dispersos. Las penalizaciones son las de la tabla
 * "Ninguna fuente es obligatoria" del doc de diseño; se recalibran con el
 * error medido contra ventas cerradas.
 */
import type { AdjustedComparable, SourceUsed } from './types';

export interface ConfidenceInput {
  sourcesUsed: SourceUsed[];
  comparables: AdjustedComparable[];
  /** Completitud del twin, 0..100 */
  precisionScore: number;
  /** null cuando la zona no tiene mediana de hace 12 meses. */
  trend12mPct?: number | null;
  /** Municipio recién dado de alta sin anuncios aún. */
  marketLoading?: boolean;
}

export interface ConfidenceResult {
  confidence: number;               // 0..100
  penalties: { reason: string; points: number }[];
}

export const PENALTIES: Record<SourceUsed['layer'], Partial<Record<SourceUsed['status'], number>>> = {
  geocoding:    { fallback: 2,  degraded: 10, missing: 10 },
  property:     { fallback: 3,  degraded: 10, missing: 20 },
  market:       { fallback: 10, degraded: 25, missing: 40 },
  comparables:  { fallback: 15, degraded: 30, missing: 30 },
  close_series: { fallback: 2,  degraded: 5,  missing: 5 },
  environment:  { fallback: 0,  degraded: 0,  missing: 0 },
  rent:         { fallback: 0,  degraded: 0,  missing: 0 },
};

/** Coeficiente de variación ponderado de los €/m² ajustados. */
function weightedCv(comps: AdjustedComparable[]): number | null {
  const w = comps.reduce((a, c) => a + c.weight, 0);
  if (!w || comps.length < 2) return null;
  const mean = comps.reduce((a, c) => a + c.weight * c.adjustedPpm2, 0) / w;
  const varW = comps.reduce((a, c) => a + c.weight * (c.adjustedPpm2 - mean) ** 2, 0) / w;
  return Math.sqrt(varW) / mean;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const penalties: ConfidenceResult['penalties'] = [];
  let score = 100;

  // 1. Fuentes ausentes o degradadas
  for (const s of input.sourcesUsed) {
    const p = PENALTIES[s.layer]?.[s.status] ?? 0;
    if (p > 0) {
      penalties.push({ reason: `${s.layer}: ${s.status} (${s.source})`, points: p });
      score -= p;
    }
  }

  // 2. Número de comparables: −2 por cada uno que falte hasta 12.
  const n = input.comparables.length;
  if (n > 0 && n < 12) {
    const p = (12 - n) * 2;
    penalties.push({ reason: `pocos comparables (${n} de 12)`, points: p });
    score -= p;
  }

  // 3. Dispersión: umbral 10 %, penalización acotada a 20.
  const cv = weightedCv(input.comparables);
  if (cv !== null && cv > 0.10) {
    const p = Math.min(20, Math.round((cv - 0.10) * 100));
    penalties.push({ reason: `dispersión de comparables ${(cv * 100).toFixed(0)} %`, points: p });
    score -= p;
  }

  if (input.trend12mPct == null) {
    penalties.push({ reason: 'sin histórico de 12 meses en la zona', points: 3 });
    score -= 3;
  }

  if (input.marketLoading) {
    penalties.push({ reason: 'mercado de la zona en primera carga', points: 12 });
    score -= 12;
  }

  // 4. Radio de búsqueda amplio
  const maxRadius = input.comparables.reduce((a, c) => Math.max(a, c.radiusM), 0);
  if (maxRadius > 1500) {
    penalties.push({ reason: `radio de comparables ${maxRadius} m`, points: 8 });
    score -= 8;
  }

  // 5. Completitud del twin
  if (input.precisionScore < 60) {
    const p = Math.round((60 - input.precisionScore) / 4);
    penalties.push({ reason: `formulario al ${input.precisionScore} %`, points: p });
    score -= p;
  }

  return { confidence: Math.max(5, Math.min(100, score)), penalties };
}

/** Etiqueta para la UI pública ("precisión" en lenguaje de propietario). */
export function confidenceLabel(c: number): 'alta' | 'media' | 'baja' {
  return c >= 75 ? 'alta' : c >= 50 ? 'media' : 'baja';
}
