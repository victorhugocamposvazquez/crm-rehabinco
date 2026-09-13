/**
 * URLs oficiales de cartografía: visor de la Sede y GetMap del WMS de la DGC.
 * El visor no se puede incrustar (rechaza el iframe). El WMS sí se pinta como imagen.
 */
import { CATASTRO_WMS } from "../constants";
import type { CoordenadaParcela } from "../coordenadas";
import { getFincaReference } from "../references";

/** Visor oficial con zoom a la parcela. Documentado por la DGC. */
export const CATASTRO_CARTOGRAFIA_MAPA =
  "https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx";

export function crearUrlMapaCatastral(referencia: string): string | null {
  const rc = getFincaReference(referencia);
  if (!rc) return null;
  return `${CATASTRO_CARTOGRAFIA_MAPA}?refcat=${encodeURIComponent(rc)}`;
}

/** Recorte WMS alrededor del centroide oficial. No inventa coordenadas. */
export function crearUrlWmsCatastral(geo: Pick<CoordenadaParcela, "x" | "y" | "srs">): string | null {
  if (!Number.isFinite(geo.x) || !Number.isFinite(geo.y)) return null;
  const geografico = /4326/.test(geo.srs);
  const margen = geografico ? 0.0008 : 50;
  const url = new URL(CATASTRO_WMS);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("VERSION", "1.1.1");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("LAYERS", "CATASTRO");
  url.searchParams.set("SRS", geo.srs);
  url.searchParams.set(
    "BBOX",
    `${geo.x - margen},${geo.y - margen},${geo.x + margen},${geo.y + margen}`
  );
  url.searchParams.set("WIDTH", "640");
  url.searchParams.set("HEIGHT", "320");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "TRUE");
  return url.toString();
}
