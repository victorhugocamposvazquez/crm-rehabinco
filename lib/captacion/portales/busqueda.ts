/** «eiris» tiene que encontrar «Eirís». La tilde no cambia el lugar. */
export function plegarBusqueda(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function coincideBusqueda(consulta: string, campos: Array<string | null | undefined>): boolean {
  const q = plegarBusqueda(consulta.trim());
  if (!q) return true;
  const texto = plegarBusqueda(campos.filter((campo): campo is string => Boolean(campo)).join(" "));
  return texto.includes(q);
}
