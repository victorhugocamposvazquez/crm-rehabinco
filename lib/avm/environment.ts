/**
 * statecrm · AVM · Entorno justo (fase 2)
 *
 * Convierte la salida de avm_environment() (vecinos más cercanos por capa y
 * conteos a 500 m) en una lista a favor / en contra / avisos, con una
 * puntuación informativa 0..100. Reglas:
 *   - Simetría: cada indicador tiene recorrido en los dos sentidos.
 *   - Solo hechos objetivos y documentados; nunca atributos de las personas.
 *   - No toca el precio en fase 1-2; lo hará el hedónico, acotado a ±10 %.
 */
import { etiquetaCriminalidad } from './crime-rate';
import type { Environment, EnvironmentItem } from './types';

interface NearestRow {
  layer: string;
  category: string | null;
  sense: 'positive' | 'negative' | 'both' | 'info' | null;
  name: string | null;
  props: Record<string, unknown>;
  distance_m: number;
}

export interface RawEnvironment {
  nearest: NearestRow[];
  counts_500m: Record<string, number>;
}

interface Rule {
  layer: string;
  category?: string;
  label: (r: NearestRow) => string;
  /** Devuelve puntos (+ a favor, − en contra) o null si no aplica. */
  points: (r: NearestRow, counts: Record<string, number>) => number | null;
  sense: EnvironmentItem['sense'];
  source: string;
}

const near = (d: number, a: number, b: number) => (d <= a ? 1 : d <= b ? 0.5 : 0);

/** Si no puntúa, igual se enseña en avisos cuando está a esta distancia. */
const AVISO_HASTA_M: Record<string, number> = {
  fuel: 400,
  power_line: 250,
  industrial: 800,
  main_road: 300,
  railway: 400,
  nightlife: 250,
  supermarket: 800,
  pharmacy: 800,
  park: 1000,
  beach: 2000,
  bus: 800,
  rail: 1500,
  health_center: 1500,
  school: 1200,
};

const CATEGORIA: Record<string, string> = {
  bus: 'Parada de bus',
  rail: 'Estación de tren o metro',
  school: 'Colegio',
  kindergarten: 'Escuela infantil',
  health: 'Centro de salud',
  health_center: 'Centro de salud',
  supermarket: 'Supermercado',
  pharmacy: 'Farmacia',
  park: 'Parque o zona verde',
  beach: 'Playa',
  noise: 'Ruido',
  main_road: 'Vía principal',
  railway: 'Vía férrea',
  nightlife: 'Ocio nocturno',
  industrial: 'Zona industrial',
  fuel: 'Gasolinera',
  power_line: 'Línea de alta tensión',
  shop: 'Comercio',
  restaurant: 'Restauración',
  gym: 'Gimnasio',
};

function tituloDe(row: NearestRow, categoria: string): string {
  const nombre = row.name?.trim();
  return nombre || categoria;
}

export const RULES: Rule[] = [
  // A favor
  { layer: 'gtfs_stop', category: 'bus', label: (r) => tituloDe(r, CATEGORIA.bus), points: (r) => 6 * near(r.distance_m, 300, 600) || null, sense: 'positive', source: 'GTFS' },
  { layer: 'gtfs_stop', category: 'rail', label: (r) => tituloDe(r, CATEGORIA.rail), points: (r) => 8 * near(r.distance_m, 600, 1200) || null, sense: 'positive', source: 'GTFS' },
  { layer: 'school', label: (r) => tituloDe(r, CATEGORIA[r.category ?? 'school'] ?? 'Colegio'), points: (r) => 5 * near(r.distance_m, 500, 1000) || null, sense: 'positive', source: 'Registro Estatal de Centros Docentes' },
  { layer: 'health', category: 'health_center', label: (r) => tituloDe(r, CATEGORIA.health_center), points: (r) => 5 * near(r.distance_m, 600, 1200) || null, sense: 'positive', source: 'Catálogo SERGAS' },
  { layer: 'osm_poi', category: 'supermarket', label: (r) => tituloDe(r, CATEGORIA.supermarket), points: (r) => 5 * near(r.distance_m, 300, 600) || null, sense: 'positive', source: 'OSM' },
  { layer: 'osm_poi', category: 'pharmacy', label: (r) => tituloDe(r, CATEGORIA.pharmacy), points: (r) => 3 * near(r.distance_m, 300, 600) || null, sense: 'positive', source: 'OSM' },
  { layer: 'osm_poi', category: 'park', label: (r) => tituloDe(r, CATEGORIA.park), points: (r) => 6 * near(r.distance_m, 300, 700) || null, sense: 'positive', source: 'OSM' },
  { layer: 'osm_poi', category: 'beach', label: (r) => tituloDe(r, CATEGORIA.beach), points: (r) => 8 * near(r.distance_m, 500, 1500) || null, sense: 'positive', source: 'OSM' },

  // En contra
  { layer: 'noise', label: (r) => tituloDe(r, `Ruido ${r.props.lden ?? '?'} dB Lden (${r.props.source_type ?? 'vía'})`), points: (r) => { const l = Number(r.props.lden ?? 0); return l >= 70 ? -10 : l >= 65 ? -6 : l >= 60 ? -3 : null; }, sense: 'negative', source: 'Mapa estratégico de ruido' },
  { layer: 'osm_poi', category: 'main_road', label: (r) => tituloDe(r, CATEGORIA.main_road), points: (r) => (r.distance_m <= 40 ? -6 : r.distance_m <= 150 ? -3 : null), sense: 'negative', source: 'OSM' },
  { layer: 'osm_poi', category: 'railway', label: (r) => tituloDe(r, CATEGORIA.railway), points: (r) => (r.distance_m <= 100 ? -6 : r.distance_m <= 250 ? -3 : null), sense: 'negative', source: 'OSM' },
  { layer: 'osm_poi', category: 'nightlife', label: (r) => tituloDe(r, CATEGORIA.nightlife), points: (r, c) => ((c.nightlife ?? 0) >= 5 && r.distance_m <= 150 ? -5 : (c.nightlife ?? 0) >= 3 && r.distance_m <= 100 ? -3 : null), sense: 'negative', source: 'OSM' },
  { layer: 'osm_poi', category: 'industrial', label: (r) => tituloDe(r, CATEGORIA.industrial), points: (r) => (r.distance_m <= 200 ? -6 : r.distance_m <= 500 ? -3 : null), sense: 'negative', source: 'OSM' },
  { layer: 'osm_poi', category: 'fuel', label: (r) => tituloDe(r, CATEGORIA.fuel), points: (r) => (r.distance_m <= 100 ? -3 : null), sense: 'negative', source: 'OSM' },
  { layer: 'osm_poi', category: 'power_line', label: (r) => tituloDe(r, CATEGORIA.power_line), points: (r) => (r.distance_m <= 100 ? -4 : null), sense: 'negative', source: 'OSM' },

  // En los dos sentidos
  { layer: 'income_section', label: (r) => `Renta media de la sección: ${r.props.income_eur ?? '?'} €`, points: (r) => { const q = Number(r.props.quintile ?? 3); return (q - 3) * 3; }, sense: 'both', source: 'INE, Atlas de renta' },
  { layer: 'building_age', label: (r) => `Edificios del entorno: media de ${r.props.mean_year ?? '?'}`, points: (r) => { const y = Number(r.props.mean_year ?? 0); return y >= 2000 ? 3 : y <= 1960 ? -3 : 0; }, sense: 'both', source: 'Catastro INSPIRE' },
];

function etiquetaSeccion(r: NearestRow): string {
  const code = String(r.props.census_section ?? '').trim();
  const edition = String(r.props.edition ?? '').trim();
  if (code && edition) return `sección ${code} · Atlas ${edition}`;
  if (code) return `sección ${code}`;
  return r.props.clear ? 'Sección censal fuera del catálogo de barrios vulnerables' : 'Sección censal en el catálogo de barrios vulnerables';
}

/** Capas de barrio o municipio: la distancia 0 no es un metro, es “el punto está dentro”. */
const SIN_DISTANCIA = new Set(['flood', 'vulnerable_section', 'crime_municipality', 'income_section', 'zone_mark']);

function distanciaDe(layer: string, metros: number): number | undefined {
  if (SIN_DISTANCIA.has(layer)) return undefined;
  return metros;
}

/** Riesgos y avisos: no puntúan, se enseñan siempre. */
const FLAG_RULES: Omit<Rule, 'points'>[] = [
  { layer: 'flood', label: (r) => (r.props.clear ? 'Sin zona inundable (T10, T100, T500)' : `Zona inundable ${r.props.period ?? 'T500'}`), sense: 'negative', source: 'SNCZI (MITECO)' },
  { layer: 'vulnerable_section', label: (r) => etiquetaSeccion(r), sense: 'negative', source: 'Observatorio de la Vulnerabilidad Urbana' },
  { layer: 'crime_municipality', label: (r) => {
    const rateN = Number(r.props.rate_per_1000);
    const peerN = Number(r.props.peer_avg);
    if (!Number.isFinite(rateN) || rateN < 0 || rateN > 200) return '';
    return etiquetaCriminalidad({
      rate: rateN,
      peer: Number.isFinite(peerN) ? peerN : null,
      peerBand: typeof r.props.peer_band === 'string' ? r.props.peer_band : null,
      period: r.props.period != null ? String(r.props.period) : null,
    });
  }, sense: 'info', source: 'Ministerio del Interior' },
  { layer: 'air_station', label: (r) => `Calidad del aire (estación a ${r.distance_m} m): ${r.props.index_label ?? '?'}`, sense: 'info', source: 'MITECO' },
  { layer: 'zone_mark', label: (r) => `Aviso del equipo: ${r.name ?? r.category} (${r.props.note ?? ''})`, sense: 'info', source: 'Conocimiento local' },
];

export function buildEnvironment(raw: RawEnvironment): Environment {
  const positives: EnvironmentItem[] = [];
  const negatives: EnvironmentItem[] = [];
  const flags: EnvironmentItem[] = [];
  let score = 50;

  const tieneRuido = raw.nearest.some((r) => r.layer === 'noise');
  if (!tieneRuido) {
    const via = raw.nearest.find((r) => r.layer === 'osm_poi' && r.category === 'main_road');
    if (via && via.distance_m <= 40) {
      raw.nearest.push({
        ...via,
        layer: 'noise',
        category: null,
        props: { lden: 66, source_type: 'tráfico (respaldo OSM)' },
        distance_m: via.distance_m,
      });
    }
  }

  for (const row of raw.nearest) {
    const rule = RULES.find((x) => x.layer === row.layer && (!x.category || x.category === row.category));
    if (rule) {
      const crudo = rule.points(row, raw.counts_500m);
      const pts = crudo == null ? null : Math.round(crudo);
      const indicator = `${row.layer}${row.category ? ':' + row.category : ''}`;
      if (pts === null || pts === 0) {
        const tope = AVISO_HASTA_M[row.category ?? row.layer] ?? 600;
        if (row.distance_m <= tope) {
          flags.push({
            indicator,
            label: rule.label(row),
            distanceM: distanciaDe(row.layer, row.distance_m),
            sense: rule.sense === 'negative' ? 'negative' : 'info',
            source: rule.source,
          });
        }
        continue;
      }
      score += pts;
      const item: EnvironmentItem = {
        indicator,
        label: rule.label(row),
        value: pts,
        distanceM: row.distance_m,
        sense: rule.sense,
        source: rule.source,
      };
      (pts > 0 ? positives : negatives).push(item);
      continue;
    }
    const flag = FLAG_RULES.find((x) => x.layer === row.layer);
    if (flag) {
      const texto = flag.label(row);
      if (!texto) continue;
      const claro = row.props.clear === true;
      flags.push({
        indicator: row.layer,
        label: texto,
        distanceM: distanciaDe(row.layer, row.distance_m),
        sense: claro ? 'info' : flag.sense,
        source: flag.source,
      });
    }
  }

  // Densidad de servicios diarios a 500 m (comercio, restauración, gimnasio…)
  const daily = (raw.counts_500m.shop ?? 0) + (raw.counts_500m.restaurant ?? 0) + (raw.counts_500m.gym ?? 0);
  if (daily >= 20) { score += 6; positives.push({ indicator: 'daily_services', label: `${daily} comercios y servicios a 500 m`, value: 6, sense: 'positive', source: 'OSM' }); }
  else if (daily <= 3) { score -= 4; negatives.push({ indicator: 'daily_services', label: `Solo ${daily} comercios y servicios a 500 m`, value: -4, sense: 'negative', source: 'OSM' }); }

  positives.sort((a, b) => Number(b.value) - Number(a.value));
  negatives.sort((a, b) => Number(a.value) - Number(b.value));

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    positives,
    negatives,
    flags,
  };
}

/** Filas RPC de capas sin distancia → banderas (por si el informe hidrata solo flags). */
export function flagsFromNearest(nearest: NearestRow[]): EnvironmentItem[] {
  return buildEnvironment({ nearest, counts_500m: {} }).flags;
}
