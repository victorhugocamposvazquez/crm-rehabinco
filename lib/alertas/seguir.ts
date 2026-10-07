/** Título que ve quien sigue a otra persona: el nombre va delante y no dice «tus». */
export function tituloAjeno(nombre: string, titulo: string): string {
  const quien = nombre.trim() || "Otra persona";
  const base = titulo.replace(/^Tus\s+/i, "");
  return `${quien} · ${base}`;
}
