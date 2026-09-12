/**
 * Aplicabilidad de la pregunta de división horizontal.
 * No clasifica YES/NO/UNKNOWN: solo aparta suelo/no construido inequívoco.
 * `detectHorizontalDivision` no se usa aquí.
 */
import type { EstadoDivisionHorizontal } from "./horizontal-division";
import { normalizarLiteralLtp } from "./ltp-catalogo";
import type { InmuebleNormalizado } from "./types";

export const ESTADO_NOT_APPLICABLE = "NOT_APPLICABLE" as const;

export type EstadoDhFinca = EstadoDivisionHorizontal | typeof ESTADO_NOT_APPLICABLE;

export const RAZON_NOT_APPLICABLE_LUSO_SUELO =
  "Catastro indica suelo sin edificar (debi.luso); la división horizontal no aplica";
export const RAZON_NOT_APPLICABLE_LUSO_URBANIZACION =
  "Catastro indica obras de urbanización o jardinería (debi.luso); la división horizontal no aplica";
export const RAZON_NOT_APPLICABLE_LDT_SUELO =
  "El literal oficial de dirección indica suelo; la división horizontal no aplica";

export type ResultadoAplicabilidadDh =
  | { aplicable: false; status: "NOT_APPLICABLE"; reason: string }
  | { aplicable: true };

/** `debi.luso` observado: "…suelos sin edificar". */
export function usoIndicaSueloSinEdificar(uso: string | null | undefined): boolean {
  const n = normalizarLiteralLtp(uso ?? "");
  return /suelo(?:s)? sin edificar/.test(n);
}

/**
 * `debi.luso` observado: "Obras de urbanización y jardineria, suelos sin edificar".
 * No basta "jardinería" suelta.
 */
export function usoIndicaObrasUrbanizacion(uso: string | null | undefined): boolean {
  const n = normalizarLiteralLtp(uso ?? "");
  return /obras de urbanizacion/.test(n) || /urbanizacion y jardineria/.test(n);
}

/** `bi.ldt` observado: "… 2 Suelo 46388 …". Palabra completa, no "Consuelo". */
export function ldtIndicaSuelo(literal: string | null | undefined): boolean {
  const n = normalizarLiteralLtp(literal ?? "");
  return /\bsuelo\b/.test(n);
}

export function evidenciaSueloOficial(inmueble: InmuebleNormalizado): string | null {
  if (usoIndicaSueloSinEdificar(inmueble.uso)) return RAZON_NOT_APPLICABLE_LUSO_SUELO;
  if (usoIndicaObrasUrbanizacion(inmueble.uso)) return RAZON_NOT_APPLICABLE_LUSO_URBANIZACION;
  if (ldtIndicaSuelo(inmueble.direccion.literal) || ldtIndicaSuelo(inmueble.finca?.literal)) {
    return RAZON_NOT_APPLICABLE_LDT_SUELO;
  }
  return null;
}

function tieneLtpOficial(inmueble: InmuebleNormalizado): boolean {
  return Boolean(inmueble.finca?.tipoLiteral?.trim());
}

/**
 * La finca es NOT_APPLICABLE solo si ninguna RC trae `ltp`
 * y todas tienen evidencia oficial inequívoca de suelo/no construido.
 * Superficie 0 no basta por sí sola.
 */
export function evaluarAplicabilidadDh(
  inmuebles: InmuebleNormalizado[]
): ResultadoAplicabilidadDh {
  if (inmuebles.length === 0) return { aplicable: true };
  if (inmuebles.some(tieneLtpOficial)) return { aplicable: true };

  const razones: string[] = [];
  for (const inmueble of inmuebles) {
    const evidencia = evidenciaSueloOficial(inmueble);
    if (!evidencia) return { aplicable: true };
    razones.push(evidencia);
  }
  return { aplicable: false, status: ESTADO_NOT_APPLICABLE, reason: razones[0] ?? RAZON_NOT_APPLICABLE_LUSO_SUELO };
}
