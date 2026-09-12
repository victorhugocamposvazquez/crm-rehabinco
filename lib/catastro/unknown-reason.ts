/**
 * Motivo descriptivo de UNKNOWN. No clasifica DH ni cambia el status.
 */
import type { EstadoDhFinca } from "./applicability";
import {
  RAZON_UNKNOWN_ERROR,
  RAZON_UNKNOWN_LTP_AUSENTE,
  RAZON_UNKNOWN_LTP_NO_RECONOCIDO,
} from "./horizontal-division";
import { normalizarLiteralLtp } from "./ltp-catalogo";

export type UnknownReason =
  | "MIXED_URBAN_RURAL"
  | "LTP_MISSING"
  | "LTP_UNRECOGNIZED"
  | "QUERY_ERROR"
  /** Fallback temporal si aparece otra causa real. No crear códigos nuevos automáticamente. */
  | "OTHER";

/** Literal oficial observado (Guía CCDyG / WCF). */
export const LTP_MIXTO_URBANO_RUSTICO =
  "Parcela, a efectos catastrales, con inmuebles de distinta clase (urbano y rústico)";

export function esLtpMixtoUrbanoRustico(ltp: string | null | undefined): boolean {
  const n = normalizarLiteralLtp(ltp ?? "");
  if (!n.includes("inmuebles de distinta clase")) return false;
  return n.includes("urbano y rustico") || n.includes("urbano rustico");
}

export function reasonCodeUnknownDe(input: {
  status: EstadoDhFinca;
  reason: string;
  rawLtp?: string | null;
}): UnknownReason | undefined {
  if (input.status !== "UNKNOWN") return undefined;
  if (esLtpMixtoUrbanoRustico(input.rawLtp)) return "MIXED_URBAN_RURAL";
  if (input.reason === RAZON_UNKNOWN_ERROR) return "QUERY_ERROR";
  if (input.reason === RAZON_UNKNOWN_LTP_AUSENTE) return "LTP_MISSING";
  if (input.reason === RAZON_UNKNOWN_LTP_NO_RECONOCIDO) return "LTP_UNRECOGNIZED";
  return "OTHER";
}

export function etiquetaMotivoUnknownUi(reasonCode: string | undefined): string | null {
  if (reasonCode === "MIXED_URBAN_RURAL") return "Parcela urbano-rústica";
  if (reasonCode === "LTP_MISSING" || reasonCode === "LTP_UNRECOGNIZED") {
    return "Catastro no proporciona la clasificación de división horizontal";
  }
  if (reasonCode === "QUERY_ERROR") return "No se pudo obtener la información necesaria";
  return null;
}

export function etiquetaMotivoUnknownCsv(reasonCode: string | undefined): string {
  if (reasonCode === "MIXED_URBAN_RURAL") return "Parcela urbano-rústica";
  if (reasonCode === "LTP_MISSING") return "LTP no informado";
  if (reasonCode === "LTP_UNRECOGNIZED") return "LTP no reconocido";
  if (reasonCode === "QUERY_ERROR") return "Error de consulta";
  return "";
}

export function recuentoReasonCodeUnknown(
  fincas: Array<{ horizontalDivision: { status: EstadoDhFinca; reasonCode?: UnknownReason } }>
): {
  unknown: number;
  unknownMixedUrbanRural: number;
  unknownLtpMissing: number;
  unknownLtpUnrecognized: number;
  unknownQueryError: number;
} {
  const unknown = fincas.filter((finca) => finca.horizontalDivision.status === "UNKNOWN");
  return {
    unknown: unknown.length,
    unknownMixedUrbanRural: unknown.filter((finca) => finca.horizontalDivision.reasonCode === "MIXED_URBAN_RURAL").length,
    unknownLtpMissing: unknown.filter((finca) => finca.horizontalDivision.reasonCode === "LTP_MISSING").length,
    unknownLtpUnrecognized: unknown.filter((finca) => finca.horizontalDivision.reasonCode === "LTP_UNRECOGNIZED").length,
    unknownQueryError: unknown.filter((finca) => finca.horizontalDivision.reasonCode === "QUERY_ERROR").length,
  };
}
