import { EMPRESA_DOCUMENTOS, formatFechaDocumento } from "./empresa-documentos";
import {
  parseClausulasPersonalizadas,
  parsePersonasArras,
  personaArrasVacia,
  type ClausulasPersonalizadasArras,
  type PersonaArras,
} from "./contrato-arras";

export type ClausulaArrendamientoKey =
  | "encabezado"
  | "reunidosArrendadores"
  | "reunidosArrendatarios"
  | "intervienen"
  | "manifiestanA"
  | "manifiestanB"
  | "primera"
  | "segunda"
  | "tercera"
  | "cuarta"
  | "quinta"
  | "sexta"
  | "septima"
  | "octava"
  | "novena"
  | "decima"
  | "undecima"
  | "duodecima"
  | "decimotercera"
  | "decimocuarta"
  | "decimoquinta"
  | "decimosexta"
  | "cierre";

export type ClausulasPersonalizadasArrendamiento = Partial<Record<ClausulaArrendamientoKey, string>>;

export type ContratoArrendamientoDatos = {
  lugar: string;
  fecha: string | null;
  arrendadores: PersonaArras[];
  arrendatarios: PersonaArras[];
  vivienda_direccion: string;
  referencia_catastral: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  renta_anual: number | null;
  renta_mensual: number | null;
  cuenta_arrendadora: string;
  fianza: number | null;
  renta_periodo_texto: string;
  seguro_importe: number | null;
  clausulas_personalizadas: ClausulasPersonalizadasArrendamiento;
};

export function contratoArrendamientoVacio(): ContratoArrendamientoDatos {
  return {
    lugar: EMPRESA_DOCUMENTOS.lugar,
    fecha: null,
    arrendadores: [personaArrasVacia("Don")],
    arrendatarios: [personaArrasVacia("Doña")],
    vivienda_direccion: "",
    referencia_catastral: "",
    fecha_inicio: null,
    fecha_fin: null,
    renta_anual: null,
    renta_mensual: null,
    cuenta_arrendadora: "",
    fianza: null,
    renta_periodo_texto: "",
    seguro_importe: null,
    clausulas_personalizadas: {},
  };
}

export function parseClausulasArrendamiento(value: unknown): ClausulasPersonalizadasArrendamiento {
  return parseClausulasPersonalizadas(value) as ClausulasPersonalizadasArrendamiento;
}

export function contratoArrendamientoDesdeFila(row: {
  lugar: string;
  fecha: string | null;
  arrendadores: unknown;
  arrendatarios: unknown;
  vivienda_direccion: string | null;
  referencia_catastral: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  renta_anual: number | string | null;
  renta_mensual: number | string | null;
  cuenta_arrendadora: string | null;
  fianza: number | string | null;
  renta_periodo_texto: string | null;
  seguro_importe: number | string | null;
  clausulas_personalizadas?: unknown;
}): ContratoArrendamientoDatos {
  const arrendadores = parsePersonasArras(row.arrendadores);
  const arrendatarios = parsePersonasArras(row.arrendatarios);
  return {
    lugar: row.lugar || EMPRESA_DOCUMENTOS.lugar,
    fecha: row.fecha,
    arrendadores: arrendadores.length ? arrendadores : [personaArrasVacia("Don")],
    arrendatarios: arrendatarios.length ? arrendatarios : [personaArrasVacia("Doña")],
    vivienda_direccion: row.vivienda_direccion ?? "",
    referencia_catastral: row.referencia_catastral ?? "",
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    renta_anual: row.renta_anual == null ? null : Number(row.renta_anual),
    renta_mensual: row.renta_mensual == null ? null : Number(row.renta_mensual),
    cuenta_arrendadora: row.cuenta_arrendadora ?? "",
    fianza: row.fianza == null ? null : Number(row.fianza),
    renta_periodo_texto: row.renta_periodo_texto ?? "",
    seguro_importe: row.seguro_importe == null ? null : Number(row.seguro_importe),
    clausulas_personalizadas: parseClausulasArrendamiento(row.clausulas_personalizadas),
  };
}

export function fechaDocumentoOHueco(dateStr: string | null | undefined): string {
  return formatFechaDocumento(dateStr, { vacio: "____ de ____________ de ______" });
}

export type ClausulasPreviewArrendamiento = ClausulasPersonalizadasArras;
