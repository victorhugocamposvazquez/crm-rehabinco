/**
 * Diagnóstico de UNKNOWN. No clasifica DH: solo agrupa las causas que ya produce
 * `detectHorizontalDivision` / `clasificarFincaPorLtp`.
 */
import type { EstadoDhFinca } from "./applicability";
import {
  RAZON_UNKNOWN_ERROR,
  RAZON_UNKNOWN_LTP_AUSENTE,
  RAZON_UNKNOWN_LTP_NO_RECONOCIDO,
} from "./horizontal-division";

export type CausaUnknown =
  | "consulta_error"
  | "ltp_ausente"
  | "ltp_desconocido"
  | "otra";

/** Lo que el clasificador ya distingue. Timeout no viaja en el snapshot de finca. */
export type RecuentoCausasUnknown = {
  unknownTotal: number;
  byReason: {
    consultaError: number;
    ltpAusente: number;
    ltpDesconocido: number;
    otra: number;
  };
  /** Literales oficiales que produjeron UNKNOWN, agrupados por valor exacto. */
  byLtp: Array<{ ltp: string; count: number }>;
  /**
   * Catastro respondió con un `ltp` que no es evidencia explícita de DH,
   * o respondió OK sin `ltp`. No es un fallo de red/sesión nuestro.
   */
  catastroNoClasifica: number;
  /**
   * No llegamos a un `ltp` usable: error de consulta (HTTP, código Catastro, excepción).
   */
  falloOperativo: number;
};

export type FincaParaDiagnosticoUnknown = {
  fincaReference: string;
  ltp?: string | null;
  horizontalDivision: {
    status: EstadoDhFinca;
    reason: string;
  };
  portals?: string[];
  postalCodes?: string[];
};

export function causaUnknownDe(finca: FincaParaDiagnosticoUnknown): CausaUnknown | null {
  if (finca.horizontalDivision.status !== "UNKNOWN") return null;
  const reason = finca.horizontalDivision.reason;
  if (reason === RAZON_UNKNOWN_ERROR) return "consulta_error";
  if (reason === RAZON_UNKNOWN_LTP_NO_RECONOCIDO) return "ltp_desconocido";
  if (reason === RAZON_UNKNOWN_LTP_AUSENTE) return "ltp_ausente";
  return "otra";
}

export function recuentoCausasUnknown(
  fincas: FincaParaDiagnosticoUnknown[]
): RecuentoCausasUnknown {
  const unknowns = fincas.filter((finca) => finca.horizontalDivision.status === "UNKNOWN");
  const byReason = {
    consultaError: 0,
    ltpAusente: 0,
    ltpDesconocido: 0,
    otra: 0,
  };
  const literales = new Map<string, number>();

  for (const finca of unknowns) {
    const causa = causaUnknownDe(finca);
    if (causa === "consulta_error") byReason.consultaError += 1;
    else if (causa === "ltp_ausente") byReason.ltpAusente += 1;
    else if (causa === "ltp_desconocido") byReason.ltpDesconocido += 1;
    else byReason.otra += 1;

    const ltp = finca.ltp?.trim();
    if (ltp) literales.set(ltp, (literales.get(ltp) ?? 0) + 1);
  }

  return {
    unknownTotal: unknowns.length,
    byReason,
    byLtp: [...literales.entries()]
      .map(([ltp, count]) => ({ ltp, count }))
      .sort((a, b) => b.count - a.count || a.ltp.localeCompare(b.ltp, "es")),
    catastroNoClasifica: byReason.ltpDesconocido + byReason.ltpAusente,
    falloOperativo: byReason.consultaError,
  };
}

export function muestraUnknown(
  fincas: FincaParaDiagnosticoUnknown[],
  limite = 20
): Array<{
  fincaReference: string;
  ltp: string | null;
  reason: string;
  causa: CausaUnknown;
  portal: string | null;
  postalCodes: string[];
}> {
  return fincas
    .filter((finca) => finca.horizontalDivision.status === "UNKNOWN")
    .slice(0, limite)
    .map((finca) => ({
      fincaReference: finca.fincaReference,
      ltp: finca.ltp?.trim() || null,
      reason: finca.horizontalDivision.reason,
      causa: causaUnknownDe(finca) ?? "otra",
      portal: finca.portals?.[0] ?? null,
      postalCodes: finca.postalCodes ?? [],
    }));
}
