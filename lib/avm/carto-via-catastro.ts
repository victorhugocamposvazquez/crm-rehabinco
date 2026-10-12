/**
 * Etiquetas tip_via de CartoCiudad → sigla oficial Catastro (Anexo II).
 * Incluye variantes en lenguas cooficiales.
 */
import { TIPOS_VIA_OFICIALES } from "../catastro/constants";

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Sinónimos CartoCiudad (normalizados) → sigla Catastro. */
export const CARTO_VIA_A_CATASTRO: Readonly<Record<string, string>> = {
  CALLE: "CL",
  CARRER: "CL",
  RUA: "CL",
  RÚA: "CL",
  KALEA: "CL",
  AVENIDA: "AV",
  AVINGUDA: "AV",
  ETORBIDEA: "AV",
  AVDA: "AV",
  AV: "AV",
  PLAZA: "PZ",
  PLAÇA: "PZ",
  PLACA: "PZ",
  PRAZA: "PZ",
  ENPARANTZA: "PZ",
  PASEO: "PS",
  PASSEIG: "PS",
  TRAVESIA: "TR",
  TRAVESÍA: "TR",
  TRAVESSERA: "TR",
  RAMBLA: "RB",
  CAMINO: "CM",
  CAMI: "CM",
  CAMÍ: "CM",
  CAMIÑO: "CM",
  CARRETERA: "CR",
  RONDA: "RD",
  PASAJE: "PJ",
  PASSATGE: "PJ",
  GLORIETA: "GL",
  URBANIZACION: "UR",
  URBANIZACIÓN: "UR",
  URBANITZACIO: "UR",
  POLIGONO: "PL",
  POLÍGONO: "PL",
  PG: "PL",
  POLIGON: "PL",
  LUGAR: "LG",
  PARTIDA: "PD",
  BARRIO: "BO",
  AUZOA: "BO",
  DISEMINADO: "DS",
  DISEMINADOS: "DS",
  CUESTA: "CT",
  COSTANILLA: "CT",
  "GRAN VIA": "GV",
  "GRAN VÍA": "GV",
  GRANVIA: "GV",
  AUTOPISTA: "AU",
  AUTOVIA: "AU",
  AUTOVÍA: "AU",
  "CARRETERA COMARCAL": "CR",
  "PASEO MARITIMO": "PS",
  "PASEO MARÍTIMO": "PS",
  PLAZOLETA: "PC",
  PLACETA: "PC",
  CALLEJON: "CJ",
  CALLEJA: "CJ",
  CALLEJÓN: "CJ",
  RINCON: "RC",
  RINCÓN: "RC",
  PARQUE: "PQ",
  VIA: "VI",
  VÍA: "VI",
  VIAL: "VL",
  TRAVESERA: "TR",
  SENDA: "SD",
  SUBIDA: "SU",
  BAJADA: "BJ",
  ALAMEDA: "AL",
  PROLONGACION: "PR",
  PROLONGACIÓN: "PR",
  CONTINUAC: "PR",
  "CONTINUAC.": "PR",
  "RONDA DE": "RD",
  "GLORIETA DE": "GL",
  URB: "UR",
  CM: "CM",
  CL: "CL",
  PZ: "PZ",
  PS: "PS",
  TR: "TR",
  RB: "RB",
  CR: "CR",
  RD: "RD",
  PJ: "PJ",
  GL: "GL",
  UR: "UR",
  LG: "LG",
  PD: "PD",
  BO: "BO",
  DS: "DS",
  CT: "CT",
};

/** Etiquetas que CartoCiudad ha emitido en producción (ampliar al encontrar nuevas). */
export const CARTO_VIA_LABELS_CATALOGADAS: readonly string[] = Object.keys(CARTO_VIA_A_CATASTRO);

const OFICIAL = new Set(TIPOS_VIA_OFICIALES.map((t) => t.codigo));

export function siglaViaCartoCiudad(tipVia: string | null | undefined): string {
  const t = norm(tipVia ?? "CALLE");
  if (OFICIAL.has(t)) return t;
  const mapped = CARTO_VIA_A_CATASTRO[t];
  if (mapped && OFICIAL.has(mapped)) return mapped;
  const porCodigo = TIPOS_VIA_OFICIALES.find((item) => item.codigo === t);
  if (porCodigo) return porCodigo.codigo;
  const porNombre = TIPOS_VIA_OFICIALES.find((item) =>
    item.nombres.some((nombre) => norm(nombre) === t),
  );
  if (porNombre) return porNombre.codigo;
  return "CL";
}

/** Ninguna etiqueta del catálogo Carto debe quedar sin sigla válida. */
export function cartoViaCatalogoCompleto(): string[] {
  const rotos: string[] = [];
  for (const label of CARTO_VIA_LABELS_CATALOGADAS) {
    const sigla = siglaViaCartoCiudad(label);
    if (!OFICIAL.has(sigla)) rotos.push(label);
  }
  return rotos;
}
