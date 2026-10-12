import type { Environment } from "./types";

export type CapaConsultada = {
  layer: string;
  source: string;
  loaded_at: string;
};

export type EntornoCoverage = {
  municipality_has_layers: boolean;
  elements_within_600m: number;
  layers_consulted: CapaConsultada[];
  /** Criminalidad u OVU cargadas para el municipio/sección (sin distancia). */
  municipal_stats_loaded?: boolean;
};

export type AvisoEntornoVacio =
  | { kind: "sin_capas"; municipalityLabel: string }
  | { kind: "sin_cerca"; layers: CapaConsultada[] };

export function parseEntornoCoverage(data: unknown): EntornoCoverage | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const layers = Array.isArray(o.layers_consulted) ? o.layers_consulted : [];
  return {
    municipality_has_layers: Boolean(o.municipality_has_layers),
    elements_within_600m: Number(o.elements_within_600m ?? 0),
    municipal_stats_loaded: Boolean(o.municipal_stats_loaded),
    layers_consulted: layers
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          layer: String(r.layer ?? ""),
          source: String(r.source ?? ""),
          loaded_at: String(r.loaded_at ?? ""),
        };
      })
      .filter((r) => r.layer),
  };
}

/** Sin filas a favor/en contra ni avisos (flags) en el snapshot guardado al valorar. */
export function entornoSinElementosPuntuables(environment: Environment | null): boolean {
  if (!environment) return true;
  const flags = environment.flags?.length ?? 0;
  if (flags > 0) return false;
  return !environment.positives.length && !environment.negatives.length;
}

const CAPAS_AMBITO_MUNICIPIO = new Set(["crime_municipality", "vulnerable_section"]);

export function avisoEntornoVacio(
  environment: Environment | null,
  coverage: EntornoCoverage | null,
  municipalityLabel: string,
): AvisoEntornoVacio | null {
  if (!entornoSinElementosPuntuables(environment)) return null;
  const flagsMunicipales = environment?.flags?.length ?? 0;
  if (flagsMunicipales > 0) return null;
  if (!coverage?.municipality_has_layers) {
    return { kind: "sin_capas", municipalityLabel };
  }
  if (coverage.elements_within_600m === 0) {
    const soloAmbitoMunicipio =
      coverage.layers_consulted.length > 0 &&
      coverage.layers_consulted.every((l) => CAPAS_AMBITO_MUNICIPIO.has(l.layer));
    if (coverage.municipal_stats_loaded || soloAmbitoMunicipio) return null;
    return { kind: "sin_cerca", layers: coverage.layers_consulted };
  }
  return null;
}

export function fmtCapaEntorno(layer: string): string {
  const map: Record<string, string> = {
    osm_poi: "OSM · POI",
    gtfs_stop: "GTFS · paradas",
    school: "Centros docentes",
    health: "Centros sanitarios",
    noise: "Ruido Lden",
    flood: "Inundabilidad SNCZI",
    vulnerable_section: "Barrios vulnerables (OVU)",
    crime_municipality: "Criminalidad municipal",
    building_age: "Edad edificios (Catastro)",
    income_section: "Renta sección censal",
  };
  return map[layer] ?? layer;
}
