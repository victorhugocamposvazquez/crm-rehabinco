import { CATALOGO_LTP, normalizarLiteralLtp } from "./ltp-catalogo";
import type {
  ErrorCatastro,
  ResultadoConsultaCatastro,
  TipoRespuestaCatastro,
} from "./types";

export type EstadoDivisionHorizontal = "YES" | "NO" | "UNKNOWN";

export type EvidenciaDivisionHorizontal = {
  source: string;
  field: string;
  value: string;
};

export type ResultadoDivisionHorizontal = {
  status: EstadoDivisionHorizontal;
  classification: EstadoDivisionHorizontal;
  confidence: number;
  rawLtp: string | null;
  evidence: "finca.ltp" | "consulta.error" | null;
  reason: string;
  evidenceItems: EvidenciaDivisionHorizontal[];
};

/** Causas reales de UNKNOWN. No ampliar el clasificador: solo nombrar lo que ya hace. */
export const RAZON_UNKNOWN_ERROR =
  "Catastro devolvió un error; no hay evidencia suficiente para clasificar la división horizontal";
export const RAZON_UNKNOWN_LTP_NO_RECONOCIDO =
  "El literal de finca.ltp está presente pero no se reconoce como evidencia explícita de división horizontal";
export const RAZON_UNKNOWN_LTP_AUSENTE =
  "No hay finca.ltp; no se infiere división horizontal a partir de otros datos";

export type DetectHorizontalDivisionInput = {
  rawLtp?: string | null;
  tipo?: TipoRespuestaCatastro;
  error?: ErrorCatastro | null;
  inmueblesCount?: number | null;
  construccionesCount?: number | null;
};

type ReglaLtp = {
  id: string;
  classification: Exclude<EstadoDivisionHorizontal, "UNKNOWN">;
  test: (normalizado: string) => boolean;
  reason: string;
};

/**
 * Únicas reglas que clasifican YES/NO: literales observados en el WCF
 * que mencionan explícitamente división horizontal.
 */
const REGLAS_LTP_VALIDADAS: ReglaLtp[] = [
  {
    id: "ltp-sin-division-horizontal",
    classification: "NO",
    test: (texto) => /\bsin\s+division\s+horizontal\b/.test(texto),
    reason:
      "Catastro indica explícitamente que la parcela está construida sin división horizontal",
  },
  {
    id: "ltp-con-division-horizontal",
    classification: "YES",
    test: (texto) =>
      /\bdivision\s+horizontal\b/.test(texto) && !/\bsin\s+division\s+horizontal\b/.test(texto),
    reason: "Catastro indica explícitamente la existencia de división horizontal",
  },
];

function resultado(
  status: EstadoDivisionHorizontal,
  input: {
    confidence: number;
    reason: string;
    rawLtp: string | null;
    evidence: ResultadoDivisionHorizontal["evidence"];
    evidenceItems: EvidenciaDivisionHorizontal[];
  }
): ResultadoDivisionHorizontal {
  return {
    status,
    classification: status,
    confidence: input.confidence,
    rawLtp: input.rawLtp,
    evidence: input.evidence,
    reason: input.reason,
    evidenceItems: input.evidenceItems,
  };
}

function extraerLtp(consulta: ResultadoConsultaCatastro): string | null {
  const literales = consulta.results
    .map((item) => item.finca?.tipoLiteral?.trim())
    .filter((item): item is string => Boolean(item));
  return literales[0] ?? null;
}

export function evidenciaDesdeConsulta(
  consulta: ResultadoConsultaCatastro
): DetectHorizontalDivisionInput {
  return {
    rawLtp: extraerLtp(consulta),
    tipo: consulta.tipo,
    error: consulta.error,
    inmueblesCount: consulta.control.inmuebles ?? consulta.results.length,
    construccionesCount:
      consulta.control.construcciones ??
      consulta.results.reduce((total, item) => total + item.unidades.length, 0),
  };
}

function esConsulta(
  input: DetectHorizontalDivisionInput | ResultadoConsultaCatastro
): input is ResultadoConsultaCatastro {
  return "results" in input && "operacion" in input && "raw" in input;
}

/**
 * Clasifica solo con evidencia explícita de `finca.ltp`.
 * No usa número de inmuebles, lcons, plantas ni superficies.
 */
export function detectHorizontalDivision(
  input: DetectHorizontalDivisionInput | ResultadoConsultaCatastro
): ResultadoDivisionHorizontal {
  const datos = esConsulta(input) ? evidenciaDesdeConsulta(input) : input;
  const rawLtp = datos.rawLtp?.trim() || null;
  const evidenceItems: EvidenciaDivisionHorizontal[] = [];

  if (datos.error) {
    evidenceItems.push(
      { source: "lerr", field: "cod", value: datos.error.codigo },
      { source: "lerr", field: "des", value: datos.error.descripcion }
    );
    return resultado("UNKNOWN", {
      confidence: 0,
      reason: RAZON_UNKNOWN_ERROR,
      rawLtp,
      evidence: "consulta.error",
      evidenceItems,
    });
  }

  if (rawLtp) {
    evidenceItems.push({ source: "finca.ltp", field: "ltp", value: rawLtp });
    const normalizado = normalizarLiteralLtp(rawLtp);
    const regla = REGLAS_LTP_VALIDADAS.find((item) => item.test(normalizado));

    if (regla) {
      evidenceItems.push({ source: "finca.ltp", field: "rule", value: regla.id });
      return resultado(regla.classification, {
        confidence: 1,
        reason: regla.reason,
        rawLtp,
        evidence: "finca.ltp",
        evidenceItems,
      });
    }

    const catalogado = CATALOGO_LTP.find(
      (item) =>
        item.classification === "UNKNOWN" &&
        normalizarLiteralLtp(item.literal) === normalizado
    );
    if (catalogado) {
      evidenceItems.push({
        source: "catalogo.ltp",
        field: "origen",
        value: catalogado.origen,
      });
    }

    return resultado("UNKNOWN", {
      confidence: 0,
      reason: RAZON_UNKNOWN_LTP_NO_RECONOCIDO,
      rawLtp,
      evidence: "finca.ltp",
      evidenceItems,
    });
  }

  return resultado("UNKNOWN", {
    confidence: 0,
    reason: RAZON_UNKNOWN_LTP_AUSENTE,
    rawLtp: null,
    evidence: null,
    evidenceItems,
  });
}

export const REGLAS_LTP_DH = REGLAS_LTP_VALIDADAS.map((regla) => regla.id);
