/** Tasa = infracciones del periodo × 1.000 / población. Fuera de 0–200 no se publica. */
export function tasaPorMil(infracciones: number, poblacion: number): number | null {
  if (!Number.isFinite(infracciones) || !Number.isFinite(poblacion) || poblacion <= 0 || infracciones < 0) {
    return null;
  }
  const tasa = (infracciones * 1000) / poblacion;
  if (tasa < 0 || tasa > 200) return null;
  return tasa;
}

/** Banda de población para la media de ciudades comparables. */
export function bandaPoblacion(poblacion: number): string {
  if (poblacion >= 500_000) return "500.000 o más";
  if (poblacion >= 200_000) return "200.000–500.000";
  if (poblacion >= 100_000) return "100.000–200.000";
  if (poblacion >= 50_000) return "50.000–100.000";
  if (poblacion >= 20_000) return "20.000–50.000";
  return "menos de 20.000";
}

/** "2026T2" o "2T 2026" → "2T 2026". Un año suelto se queda como año. */
export function fmtPeriodoCriminalidad(period: string): string {
  const compacto = period.trim();
  const anioTrimestre = compacto.match(/^(\d{4})\s*T\s*([1-4])$/i);
  if (anioTrimestre) return `${anioTrimestre[2]}T ${anioTrimestre[1]}`;
  const trimestreAnio = compacto.match(/^([1-4])\s*T\s*(\d{4})$/i);
  if (trimestreAnio) return `${trimestreAnio[1]}T ${trimestreAnio[2]}`;
  return compacto;
}

export function fmtTasaEs(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function etiquetaCriminalidad(opts: {
  rate: number;
  peer: number | null;
  peerBand: string | null;
  period: string | null;
}): string {
  const tasa = fmtTasaEs(opts.rate);
  const media =
    opts.peer != null && Number.isFinite(opts.peer)
      ? opts.peerBand
        ? `media de ciudades de ${opts.peerBand} hab.: ${fmtTasaEs(opts.peer)}`
        : `media de ciudades similares: ${fmtTasaEs(opts.peer)}`
      : null;
  const periodo = opts.period ? fmtPeriodoCriminalidad(opts.period) : null;
  const fuente = periodo ? `Ministerio del Interior, ${periodo}` : "Ministerio del Interior";
  return [`Criminalidad municipal: ${tasa} infracciones por 1.000 hab.`, media, fuente].filter(Boolean).join(" · ");
}
