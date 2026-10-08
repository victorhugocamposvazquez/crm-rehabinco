/** Aviso de un guardado. Si Postgres trae la causa, se enseña junto a la frase. */
export function mensajeGuardado(
  error: { message?: string } | null | undefined,
  fallback: string,
  fila: unknown = true
): string | null {
  const vacia = fila == null || (Array.isArray(fila) && fila.length === 0);
  if (!error && !vacia) return null;
  const causa = error?.message?.trim();
  return causa ? `${fallback} ${causa}` : fallback;
}
