/**
 * Consulta_CPMRC: coordenadas del centroide por RC de finca (14).
 * Fuente: Webservices_Libres.pdf §2.2.2 / COVCCoordenadas.json
 */
import { asArray, asRecord, asString, parseNumeroCatastral } from "./parse";

export type CoordenadaParcela = {
  x: number;
  y: number;
  srs: string;
  fincaReference: string;
};

export function parsearCoordenadasCpmrc(raw: unknown): CoordenadaParcela | null {
  const raiz = asRecord(raw);
  const resultado = asRecord(raiz?.Consulta_CPMRCResult) ?? raiz;
  const lista = asRecord(resultado?.coordenadas);
  const primera = asRecord(asArray(lista?.coord)[0]);
  const geo = asRecord(primera?.geo);
  const x = parseNumeroCatastral(geo?.xcen);
  const y = parseNumeroCatastral(geo?.ycen);
  if (x == null || y == null) return null;
  const pc = asRecord(primera?.pc);
  const fincaReference = `${asString(pc?.pc1) ?? ""}${asString(pc?.pc2) ?? ""}`;
  return {
    x,
    y,
    srs: asString(geo?.srs) ?? "EPSG:4326",
    fincaReference,
  };
}
