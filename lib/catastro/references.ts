/** Identidad de finca: primeros 14 caracteres de la RC oficial. */
export const LONGITUD_FINCA = 14;
/** Referencia de inmueble / cargo: 20 caracteres oficiales. */
export const LONGITUD_INMUEBLE = 20;

export function normalizarReferencia(referencia: string | null | undefined): string {
  return referencia?.replace(/\s/g, "").toUpperCase() ?? "";
}

export function esReferenciaFinca(referencia: string | null | undefined): referencia is string {
  return normalizarReferencia(referencia).length === LONGITUD_FINCA;
}

export function esReferenciaInmueble(referencia: string | null | undefined): referencia is string {
  return normalizarReferencia(referencia).length === LONGITUD_INMUEBLE;
}

/**
 * Única función de identidad de finca.
 * RC de 20 → primeros 14. RC de 14 → ella misma. Cualquier otra longitud → null.
 */
export function getFincaReference(referencia: string | null | undefined): string | null {
  const limpia = normalizarReferencia(referencia);
  if (limpia.length === LONGITUD_INMUEBLE || limpia.length === LONGITUD_FINCA) {
    return limpia.slice(0, LONGITUD_FINCA);
  }
  return null;
}

export function getPropertyReference(referencia: string | null | undefined): string | null {
  const limpia = normalizarReferencia(referencia);
  return limpia.length === LONGITUD_INMUEBLE ? limpia : null;
}

/** Alias estable: misma regla que `getFincaReference`. */
export const referenciaParcelaDe = getFincaReference;
