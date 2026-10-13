const entero = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: true });
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: true });

export function fmtEuros(n: number): string {
  return euro.format(n);
}

export function fmtNumero(n: number, decimales = 0): string {
  return new Intl.NumberFormat("es-ES", {
    useGrouping: true,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function fmtEurosPorM2(n: number): string {
  return `${entero.format(Math.round(n))} €/m²`;
}

export function fmtRangoNumeros(a: number, b: number): string {
  return `${entero.format(Math.round(a))}–${entero.format(Math.round(b))}`;
}

export function fmtRangoEuros(a: number, b: number): string {
  return `${fmtEuros(a)} – ${fmtEuros(b)}`;
}

/** Porcentaje: un decimal si el valor absoluto es menor que 10. */
export function fmtPorcentaje(n: number): string {
  const abs = Math.abs(n);
  const dec = abs < 10 && abs % 1 !== 0 ? 1 : abs < 10 ? 1 : 0;
  const s = fmtNumero(n, dec);
  return `${s} %`;
}

export function fmtFechaLarga(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtFechaCorta(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Primer mes con histórico + 6 meses → «abril de 2027». */
export function fmtMesHistoricoDisponible(primerMesIso: string): string {
  const d = new Date(primerMesIso);
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}
