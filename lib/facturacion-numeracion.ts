import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Numeración de factura ordinaria: N/AAAA (ej. 1/2026)
 * Rectificativas: FR-N/AAAA (ej. FR-1/2026)
 */

export function anioEmisionFecha(fechaEmision: string | null | undefined): number {
  if (fechaEmision && /^\d{4}-\d{2}-\d{2}/.test(fechaEmision)) {
    return new Date(fechaEmision + "T12:00:00").getFullYear();
  }
  return new Date().getFullYear();
}

const reOrdinaria = (year: number) => new RegExp(`^(\\d+)/${year}$`);
const reRectificativa = (year: number) => new RegExp(`^FR-(\\d+)/${year}$`);

const RE_FORMATO_ORDINARIA = /^\d+\/\d{4}$/;
const RE_FORMATO_RECTIFICATIVA = /^FR-\d+\/\d{4}$/;

/** Devuelve mensaje de error o null si el formato es válido. */
export function validarFormatoNumeroFactura(numero: string, esRectificativa: boolean): string | null {
  const n = numero.trim();
  if (!n) return "Indica el número de factura.";
  const ok = esRectificativa ? RE_FORMATO_RECTIFICATIVA.test(n) : RE_FORMATO_ORDINARIA.test(n);
  if (!ok) {
    return esRectificativa
      ? "Formato: FR-N/AAAA (ej. FR-3/2026)."
      : "Formato: N/AAAA (ej. 12/2026).";
  }
  return null;
}

export function normalizarNumeroFactura(numero: string): string {
  return numero.trim();
}

/** True si ya existe otra factura con ese número (cualquier usuario del CRM). */
export async function numeroFacturaEnUso(
  supabase: SupabaseClient<Database>,
  numero: string,
  excludeFacturaId?: string
): Promise<boolean> {
  const n = normalizarNumeroFactura(numero);
  if (!n) return false;
  let query = supabase.from("facturas").select("id").eq("numero", n).limit(1);
  if (excludeFacturaId) query = query.neq("id", excludeFacturaId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

function maxFromMatches(numeros: string[], re: RegExp): number {
  let max = 0;
  for (const n of numeros) {
    const m = n.trim().match(re);
    if (m) {
      const v = parseInt(m[1], 10);
      if (!Number.isNaN(v)) max = Math.max(max, v);
    }
  }
  return max;
}

/**
 * Siguiente número a partir de los `numero` ya guardados (p. ej. tras editar una factura a 16/2026,
 * el máximo del ejercicio pasa a 16 y la propuesta será 17/2026). No mira fecha de creación ni huecos.
 */
export function siguienteNumeroFacturaDesdeLista(
  numeros: string[],
  options: { year: number; esRectificativa: boolean }
): string {
  const { year, esRectificativa } = options;
  const y = String(year);
  if (esRectificativa) {
    const next = maxFromMatches(numeros, reRectificativa(year)) + 1;
    return `FR-${next}/${y}`;
  }
  const next = maxFromMatches(numeros, reOrdinaria(year)) + 1;
  return `${next}/${y}`;
}

/**
 * Calcula el siguiente número de factura (ordinaria o rectificativa) en el ejercicio `year`.
 * Lee todos los `numero` visibles en BD para el tipo; el correlativo es max(N)+1 del año en el texto.
 */
export async function siguienteNumeroFactura(
  supabase: SupabaseClient<Database>,
  options: { year: number; esRectificativa: boolean }
): Promise<string> {
  const { esRectificativa } = options;

  if (esRectificativa) {
    const { data, error } = await supabase
      .from("facturas")
      .select("numero")
      .eq("tipo_factura", "rectificativa");

    if (error) throw new Error(error.message);
    const numeros = (data ?? []).map((r) => (r as { numero: string }).numero);
    return siguienteNumeroFacturaDesdeLista(numeros, options);
  }

  const { data, error } = await supabase
    .from("facturas")
    .select("numero")
    .or("tipo_factura.eq.ordinaria,tipo_factura.is.null");

  if (error) throw new Error(error.message);
  const numeros = (data ?? []).map((r) => (r as { numero: string }).numero);
  return siguienteNumeroFacturaDesdeLista(numeros, options);
}
