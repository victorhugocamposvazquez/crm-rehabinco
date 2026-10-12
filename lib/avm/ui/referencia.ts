export function normalizarReferencia(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** 20 caracteres: inmueble. 14: parcela. */
export function tipoReferencia(raw: string): "inmueble" | "parcela" | null {
  const t = normalizarReferencia(raw);
  if (/^[0-9A-Z]{20}$/.test(t)) return "inmueble";
  if (/^[0-9A-Z]{14}$/.test(t)) return "parcela";
  return null;
}
