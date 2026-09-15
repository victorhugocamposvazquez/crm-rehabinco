export function siguienteReferencia(refs: Array<string | null | undefined>, year: number): string {
  const re = new RegExp(`^RHB-${year}-(\\d+)$`);
  let max = 0;
  for (const ref of refs) {
    const m = ref?.trim().match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `RHB-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function tipoInmuebleDesdeAnuncio(tipo: string | null | undefined): string | null {
  if (tipo === "piso") return "piso";
  if (tipo === "casa") return "chalet";
  if (tipo === "local") return "local";
  if (tipo === "terreno") return "solar";
  if (tipo === "edificio") return "piso";
  return null;
}
