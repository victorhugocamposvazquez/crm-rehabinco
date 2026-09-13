/**
 * URLs oficiales de cartografía de la Sede Electrónica del Catastro.
 * Misma familia que `finca.infgraf.igraf` (mapa.aspx?refcat=).
 * No geocodifica ni pide coordenadas.
 */
import { getFincaReference } from "../references";

/** Visor oficial con zoom a la parcela. Documentado por la DGC. */
export const CATASTRO_CARTOGRAFIA_MAPA =
  "https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx";

/** Croquis oficial centrado en la parcela. */
export const CATASTRO_CARTOGRAFIA_CROQUIS =
  "https://www1.sedecatastro.gob.es/Cartografia/mapaC.aspx";

export function crearUrlMapaCatastral(referencia: string): string | null {
  const rc = getFincaReference(referencia);
  if (!rc) return null;
  return `${CATASTRO_CARTOGRAFIA_MAPA}?refcat=${encodeURIComponent(rc)}`;
}

export function crearUrlCroquisCatastral(referencia: string): string | null {
  const rc = getFincaReference(referencia);
  if (!rc) return null;
  const params = new URLSearchParams({ from: "OVCBusq", refcat: rc });
  return `${CATASTRO_CARTOGRAFIA_CROQUIS}?${params}`;
}
