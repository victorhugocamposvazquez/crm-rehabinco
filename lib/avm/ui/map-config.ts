/** Estilo vectorial OpenFreeMap (local o URL externa vía env). */
export function urlEstiloMapa(): string {
  return process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || "/map/dark.json";
}

export const ATRIBUCION_MAPA_BASE = "© OpenStreetMap contributors · OpenFreeMap";
export const ATRIBUCION_ORTOFOTO = "PNOA © IGN";

/** WMTS PNOA máxima actualidad (IGN), compatible GoogleMapsCompatible. */
export const WMTS_PNOA_MA =
  "https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
