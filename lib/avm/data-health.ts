export type AvmDataLayer =
  | "osm"
  | "gtfs"
  | "crime"
  | "vulnerability"
  | "snczi"
  | "noise"
  | "ine_sections"
  | "inspire";

export type AvmDataHealthRow = {
  layer: AvmDataLayer;
  loaded_at: string | null;
};

/** Meses máximos sin recarga antes de alertar (según operación). */
export const AVM_DATA_STALE_MONTHS: Record<AvmDataLayer, number> = {
  osm: 4,
  gtfs: 13,
  crime: 4,
  vulnerability: 13,
  snczi: 13,
  noise: 13,
  ine_sections: 14,
  inspire: 4,
};

export const AVM_DATA_LAYER_LABELS: Record<AvmDataLayer, string> = {
  osm: "OpenStreetMap (Geofabrik)",
  gtfs: "GTFS (paradas)",
  crime: "Criminalidad municipal",
  vulnerability: "Vulnerabilidad urbana (OVU)",
  snczi: "Inundabilidad (SNCZI)",
  noise: "Ruido (MER Lden)",
  ine_sections: "Secciones censales (INE)",
  inspire: "Catastro INSPIRE (edificios)",
};

export function evaluarCaducidadCapa(
  layer: AvmDataLayer,
  loadedAt: string | null,
  now = Date.now(),
): { stale: boolean; maxMonths: number; ageMonths: number | null } {
  const maxMonths = AVM_DATA_STALE_MONTHS[layer];
  if (!loadedAt) return { stale: true, maxMonths, ageMonths: null };
  const ageMs = now - new Date(loadedAt).getTime();
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);
  return { stale: ageMonths > maxMonths, maxMonths, ageMonths };
}
