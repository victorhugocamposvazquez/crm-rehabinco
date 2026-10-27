/** Solo dígitos: sirve para comparar teléfonos con/sin espacios. */
export function digitosBusqueda(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Coincide un teléfono aunque se busque junto y esté guardado con espacios
 * (o al revés). Con menos de 3 dígitos en la query usa includes normal.
 */
export function coincideTelefonoBusqueda(telefono: string | null | undefined, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const digitosQ = digitosBusqueda(q);
  if (digitosQ.length >= 3) {
    const digitosTel = digitosBusqueda(telefono);
    return digitosTel.length > 0 && digitosTel.includes(digitosQ);
  }
  return (telefono ?? "").toLowerCase().includes(q.toLowerCase());
}
