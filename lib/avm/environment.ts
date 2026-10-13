/**
 * statecrm · AVM · Entorno (env-1.1)
 *
 * Puntuación informativa, base 50, acotada a 0–100. No toca el precio.
 * Solo puntúan las reglas de esta versión. Criminalidad, vulnerabilidad y
 * las marcas del equipo son banderas, sin puntos. Un elemento de una capa
 * de puntos que no puntúa no se muestra.
 */
import { etiquetaCriminalidad } from './crime-rate';
import type { Environment, EnvironmentItem } from './types';

export const ENV_RULES_VERSION = 'env-1.1';

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
  counts_300m?: Record<string, number>;
  counts_100m?: Record<string, number>;
}

const ETIQUETA: Record<string, string> = {
  bus: 'Parada de bus',
  rail: 'Estación de tren o tranvía',
  school: 'Colegio',
  nursery: 'Escuela infantil',
  kindergarten: 'Escuela infantil',
  health_center: 'Centro de salud',
  health: 'Centro de salud',
  pac: 'Centro de salud',
  hospital: 'Hospital',
  supermarket: 'Supermercado',
  pharmacy: 'Farmacia',
  park: 'Parque',
  beach: 'Playa',
  sport: 'Deporte',
  noise: 'Ruido',
  main_road: 'Vía principal',
  nightlife: 'Ocio nocturno',
  industrial: 'Industria',
  shop: 'Comercio',
  hospitality: 'Hostelería',
};

const ORIGEN: Record<string, string> = {
  bus: 'GTFS',
  rail: 'GTFS',
  school: 'Registro Estatal de Centros Docentes',
  nursery: 'Registro Estatal de Centros Docentes',
  kindergarten: 'Registro Estatal de Centros Docentes',
  health_center: 'Catálogo SERGAS',
  health: 'Catálogo SERGAS',
  pac: 'Catálogo SERGAS',
  hospital: 'Catálogo SERGAS',
  noise: 'Mapa estratégico de ruido',
  flood: 'SNCZI (MITECO)',
  vulnerable_section: 'Observatorio de la Vulnerabilidad Urbana',
  crime_municipality: 'Ministerio del Interior',
  zone_mark: 'Conocimiento local',
};

function origenDe(row: NearestRow): string {
  const cat = row.category ?? row.layer;
  if (cat === 'bus' && row.props.respaldo_gtfs === true) return 'OSM (respaldo GTFS)';
  if ((cat === 'school' || cat === 'nursery' || cat === 'kindergarten') && row.props.tipo == null && row.props.fuente == null) {
    return 'OSM';
  }
  if ((cat === 'health_center' || cat === 'health' || cat === 'hospital' || cat === 'pac') && row.props.publico !== true) {
    return 'OSM';
  }
  return ORIGEN[cat] ?? 'OSM';
}

/** Con nombre: el nombre es el título y la categoría va en la fuente. Sin nombre: el título es la categoría. */
function presentar(row: NearestRow, categoria: string, origen: string, puntos: number, sentido: EnvironmentItem['sense']): EnvironmentItem {
  const nombre = row.name?.trim();
  return {
    indicator: `${row.layer}${row.category ? ':' + row.category : ''}`,
    label: nombre || categoria,
    value: puntos,
    distanceM: row.distance_m,
    sense: sentido,
    source: nombre ? `${categoria.toLowerCase()} · ${origen}` : origen,
  };
}

function closest(rows: NearestRow[], pred: (row: NearestRow) => boolean): NearestRow | undefined {
  return rows.filter(pred).sort((a, b) => a.distance_m - b.distance_m)[0];
}

function sumar(
  score: { n: number },
  dest: EnvironmentItem[],
  row: NearestRow,
  categoria: string,
  puntos: number,
  sentido: EnvironmentItem['sense'],
  motivo?: string,
): void {
  score.n += puntos;
  dest.push({ ...presentar(row, categoria, origenDe(row), puntos, sentido), motivo });
}

function etiquetaSeccion(row: NearestRow): string {
  const code = String(row.props.census_section ?? '').trim() || 'censal';
  const edition = String(row.props.edition ?? '').trim() || '2021';
  const indicator = String(row.props.indicator ?? '').trim();
  if (row.props.clear === true || !indicator) {
    return `Sección ${code} fuera del catálogo de áreas vulnerables · Atlas ${edition}`;
  }
  return `Sección ${code} en el catálogo (indicador: ${indicator})`;
}

export function buildEnvironment(raw: RawEnvironment): Environment {
  const positives: EnvironmentItem[] = [];
  const negatives: EnvironmentItem[] = [];
  const flags: EnvironmentItem[] = [];
  const score = { n: 50 };
  const rows = raw.nearest ?? [];

  const bus = closest(rows, (r) => r.category === 'bus');
  if (bus && bus.distance_m <= 300) {
    sumar(score, positives, bus, ETIQUETA.bus, bus.distance_m <= 150 ? 6 : 3, 'positive');
  }

  const rail = closest(rows, (r) => r.category === 'rail');
  if (rail && rail.distance_m <= 500) {
    sumar(score, positives, rail, ETIQUETA.rail, 4, 'positive');
  }

  const super_ = closest(rows, (r) => r.category === 'supermarket');
  if (super_ && super_.distance_m <= 600) {
    sumar(score, positives, super_, ETIQUETA.supermarket, super_.distance_m <= 300 ? 5 : 2, 'positive');
  }

  const comercios = raw.counts_500m.shop ?? 0;
  if (comercios >= 20) {
    const puntos = comercios >= 50 ? 6 : 3;
    score.n += puntos;
    positives.push({
      indicator: 'osm_poi:shop',
      label: `${comercios} comercios y servicios a 500 m`,
      value: puntos,
      sense: 'positive',
      source: 'OSM',
    });
  }

  const hosteleria = raw.counts_300m?.hospitality ?? 0;
  if (hosteleria >= 10) {
    score.n += 2;
    positives.push({
      indicator: 'osm_poi:hospitality',
      label: `${hosteleria} locales de hostelería a 300 m`,
      value: 2,
      sense: 'positive',
      source: 'OSM',
    });
  }

  const colegio = closest(rows, (r) => r.layer === 'school' && r.category !== 'nursery' && r.category !== 'kindergarten');
  if (colegio && colegio.distance_m <= 500) {
    sumar(score, positives, colegio, ETIQUETA.school, 4, 'positive');
  }

  const infantil = closest(rows, (r) => r.category === 'nursery' || r.category === 'kindergarten');
  if (infantil && infantil.distance_m <= 500) {
    sumar(score, positives, infantil, ETIQUETA.nursery, 2, 'positive');
  }

  const salud = closest(rows, (r) => r.category === 'health_center' || r.category === 'health' || r.category === 'pac');
  if (salud && salud.distance_m <= 500) {
    sumar(score, positives, salud, ETIQUETA.health_center, 4, 'positive');
  }

  const hospital = closest(rows, (r) => r.category === 'hospital');
  if (hospital && hospital.distance_m <= 1000) {
    sumar(score, positives, hospital, ETIQUETA.hospital, 3, 'positive');
  }

  const farmacia = closest(rows, (r) => r.category === 'pharmacy');
  if (farmacia && farmacia.distance_m <= 200) {
    sumar(score, positives, farmacia, ETIQUETA.pharmacy, 2, 'positive');
  }

  const parque = closest(rows, (r) => r.category === 'park');
  if (parque && parque.distance_m <= 300) {
    sumar(score, positives, parque, ETIQUETA.park, 4, 'positive');
  }

  const playa = closest(rows, (r) => r.category === 'beach');
  if (playa && playa.distance_m <= 500) {
    sumar(score, positives, playa, ETIQUETA.beach, 4, 'positive');
  }

  const deporte = closest(rows, (r) => r.category === 'sport');
  if (deporte && deporte.distance_m <= 500) {
    sumar(score, positives, deporte, ETIQUETA.sport, 2, 'positive');
  }

  const pubs = raw.counts_100m?.nightlife
    ?? rows.filter((r) => r.category === 'nightlife' && r.distance_m <= 100).length;
  if (pubs > 0) {
    const puntos = -Math.min(6, pubs * 2);
    const cercano = closest(rows, (r) => r.category === 'nightlife' && r.distance_m <= 100);
    const fila: NearestRow = cercano ?? {
      layer: 'osm_poi',
      category: 'nightlife',
      sense: 'negative',
      name: null,
      props: {},
      distance_m: 100,
    };
    if (pubs === 1 && fila.name?.trim()) {
      sumar(score, negatives, fila, ETIQUETA.nightlife, puntos, 'negative', 'Resta porque está marcado como pub a menos de 100 m');
    } else {
      score.n += puntos;
      negatives.push({
        indicator: 'osm_poi:nightlife',
        label: `${pubs} ${pubs === 1 ? 'local de ocio nocturno' : 'locales de ocio nocturno'} a 100 m`,
        value: puntos,
        sense: 'negative',
        source: 'OSM',
        motivo: 'Resta porque hay pubs o discotecas a menos de 100 m',
      });
    }
  }

  const ruido = rows
    .filter((r) => r.layer === 'noise')
    .sort((a, b) => Number(b.props.lden ?? 0) - Number(a.props.lden ?? 0))[0];
  if (ruido) {
    const lden = Number(ruido.props.lden ?? 0);
    if (lden >= 65) {
      const puntos = lden >= 70 ? -8 : -6;
      const nombre = ruido.name?.trim();
      score.n += puntos;
      negatives.push({
        indicator: 'noise',
        label: nombre || `Ruido ${lden} dB Lden`,
        value: puntos,
        distanceM: ruido.distance_m > 0 ? ruido.distance_m : undefined,
        sense: 'negative',
        source: nombre ? `ruido · ${ORIGEN.noise}` : ORIGEN.noise,
        motivo: `Resta porque el ruido Lden llega a ${lden} dB`,
      });
    }
  }

  const via = closest(rows, (r) => r.category === 'main_road');
  if (via && via.distance_m <= 40) {
    sumar(score, negatives, via, ETIQUETA.main_road, -4, 'negative', 'Resta porque hay una vía principal a menos de 40 m');
  }

  const industria = closest(rows, (r) => r.category === 'industrial');
  if (industria && industria.distance_m <= 200) {
    sumar(score, negatives, industria, ETIQUETA.industrial, -4, 'negative', 'Resta porque hay industria a menos de 200 m');
  }

  for (const row of rows) {
    if (row.layer === 'flood') {
      const periodo = String(row.props.period ?? row.category ?? '');
      const claro = row.props.clear === true || periodo === 'fuera';
      if (!claro && (periodo === 'T100' || periodo === 'T10')) score.n += -6;
      else if (!claro && periodo === 'T500') score.n += -2;
      if (!claro && (periodo === 'T100' || periodo === 'T10' || periodo === 'T500')) {
        const puntos = periodo === 'T500' ? -2 : -6;
        negatives.push({
          indicator: 'flood',
          label: `Zona inundable ${periodo}`,
          value: puntos,
          sense: 'negative',
          source: ORIGEN.flood,
          motivo: `Resta porque el portal está en zona inundable ${periodo}`,
        });
      }
      flags.push({
        indicator: 'flood',
        label: claro ? 'Sin zona inundable (T10, T100, T500)' : `Zona inundable ${periodo || 'T500'}`,
        sense: claro ? 'info' : 'negative',
        source: ORIGEN.flood,
      });
      continue;
    }
    if (row.layer === 'vulnerable_section') {
      flags.push({
        indicator: 'vulnerable_section',
        label: etiquetaSeccion(row),
        sense: row.props.clear === true ? 'info' : 'negative',
        source: ORIGEN.vulnerable_section,
      });
      continue;
    }
    if (row.layer === 'crime_municipality') {
      const rateN = Number(row.props.rate_per_1000);
      const peerN = Number(row.props.peer_avg);
      if (!Number.isFinite(rateN) || rateN < 0 || rateN > 200) continue;
      flags.push({
        indicator: 'crime_municipality',
        label: etiquetaCriminalidad({
          rate: rateN,
          peer: Number.isFinite(peerN) ? peerN : null,
          peerBand: typeof row.props.peer_band === 'string' ? row.props.peer_band : null,
          period: row.props.period != null ? String(row.props.period) : null,
        }),
        sense: 'info',
        source: ORIGEN.crime_municipality,
      });
      continue;
    }
    if (row.layer === 'zone_mark') {
      flags.push({
        indicator: 'zone_mark',
        label: `Aviso del equipo: ${row.name ?? row.category ?? 'marca'} (${row.props.note ?? ''})`,
        sense: 'info',
        source: ORIGEN.zone_mark,
      });
    }
  }

  positives.sort((a, b) => Number(b.value) - Number(a.value));
  negatives.sort((a, b) => Number(a.value) - Number(b.value));

  return {
    score: Math.max(0, Math.min(100, Math.round(score.n))),
    positives,
    negatives,
    flags,
  };
}

/** Filas RPC de capas sin distancia → banderas. */
export function flagsFromNearest(nearest: NearestRow[]): EnvironmentItem[] {
  return buildEnvironment({ nearest, counts_500m: {} }).flags;
}
