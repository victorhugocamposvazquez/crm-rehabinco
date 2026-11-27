/**
 * Cierre notarial: agregados del Portal Estadístico del Notariado.
 * No hay escrituras sueltas. El €/m² de compraventa solo fija el descuento
 * de anuncio a cierre cuando la muestra basta.
 */

export const URL_ESTADISTICAS = "https://www.penotariado.com/inmobiliario/rest/v1/private/statistics";

export const MIN_COMPRAVENTAS = 20;
export const MIN_ANUNCIOS = 30;
export const DESCUENTO_MAX = 25;

export type NivelNotariado = "municipality" | "postcode";
export type TipoNotariado = "apartment" | "house";

export type FilaCierre = {
  zoneLevel: NivelNotariado;
  zoneKey: string;
  mainType: TipoNotariado;
  ppm2: number;
  transactions: number;
  surface: number | null;
  estimated: boolean;
  period: string;
};

export type OfertaZona = {
  zoneLevel: NivelNotariado;
  zoneKey: string;
  mainType: TipoNotariado;
  n: number;
  medianPpm2: number;
};

export type DescuentoZona = {
  zoneLevel: NivelNotariado;
  zoneKey: string;
  mainType: TipoNotariado;
  discountPct: number;
  nObservations: number;
};

/** Pisos (14) y casas (15) de segunda mano (9) en el portal. */
export const CONSULTAS: { propertyType: "14" | "15"; mainType: TipoNotariado; constructionType: "9" }[] = [
  { propertyType: "14", mainType: "apartment", constructionType: "9" },
  { propertyType: "15", mainType: "house", constructionType: "9" },
];

export function filaAceptable(fila: FilaCierre): boolean {
  return !fila.estimated && fila.ppm2 > 0 && fila.transactions >= MIN_COMPRAVENTAS && fila.zoneKey.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(fila.period);
}

/** Porcentaje de anuncio a cierre, entre 0 y 25. Null si la oferta no basta. */
export function descuentoCierre(notarialPpm2: number, ofertaPpm2: number, anuncios: number): number | null {
  if (anuncios < MIN_ANUNCIOS) return null;
  if (!(notarialPpm2 > 0) || !(ofertaPpm2 > 0)) return null;
  const pct = (1 - notarialPpm2 / ofertaPpm2) * 100;
  const acotado = Math.min(DESCUENTO_MAX, Math.max(0, pct));
  return Math.round(acotado * 100) / 100;
}

/** El código postal manda. Si no hay, el municipio. */
export function elegirDescuento(porNivel: { postcode: number | null; municipality: number | null }): number | null {
  if (porNivel.postcode != null) return porNivel.postcode;
  return porNivel.municipality;
}

export function descuentosDe(cierres: FilaCierre[], ofertas: OfertaZona[]): DescuentoZona[] {
  const oferta = new Map(ofertas.map((o) => [`${o.zoneLevel}|${o.zoneKey}|${o.mainType}`, o]));
  const salida: DescuentoZona[] = [];
  for (const cierre of cierres) {
    if (!filaAceptable(cierre)) continue;
    const zona = oferta.get(`${cierre.zoneLevel}|${cierre.zoneKey}|${cierre.mainType}`);
    if (!zona) continue;
    const pct = descuentoCierre(cierre.ppm2, zona.medianPpm2, zona.n);
    if (pct == null) continue;
    salida.push({
      zoneLevel: cierre.zoneLevel,
      zoneKey: cierre.zoneKey,
      mainType: cierre.mainType,
      discountPct: pct,
      nObservations: cierre.transactions,
    });
  }
  return salida;
}

function nivelDe(valor: string): NivelNotariado | null {
  const s = valor.trim().toLowerCase();
  if (s === "municipality" || s === "municipio" || s === "mn") return "municipality";
  if (s === "postcode" || s === "cp" || s === "codigo_postal") return "postcode";
  return null;
}

function tipoDe(valor: string): TipoNotariado | null {
  const s = valor.trim().toLowerCase();
  if (s === "apartment" || s === "piso" || s === "14") return "apartment";
  if (s === "house" || s === "casa" || s === "15") return "house";
  return null;
}

function estimadoDe(row: Record<string, unknown>): boolean {
  return row.estimado === true || row.estimated === true || row.es_estimado === 1 || row.es_estimado === true;
}

function periodoDe(valor: unknown, respaldo: string): string {
  const texto = typeof valor === "string" ? valor.slice(0, 10) : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return `${texto.slice(0, 7)}-01`;
  return respaldo;
}

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : NaN;
}

/** Fichero mensual: `{ period, rows: [{ nivel, codigo, tipo, eur_m2, compraventas, ... }] }`. */
export function filasDesdeFichero(raw: unknown, periodPorDefecto: string): FilaCierre[] {
  const cuerpo = raw && typeof raw === "object" ? (raw as { period?: unknown; rows?: unknown }) : {};
  const period = periodoDe(cuerpo.period, periodPorDefecto);
  const lista = Array.isArray(cuerpo.rows) ? cuerpo.rows : Array.isArray(raw) ? raw : [];
  const salida: FilaCierre[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const zoneLevel = nivelDe(String(row.nivel ?? row.zoneLevel ?? ""));
    const mainType = tipoDe(String(row.tipo ?? row.mainType ?? ""));
    if (!zoneLevel || !mainType) continue;
    const surfaceRaw = row.superficie_media ?? row.surface;
    const fila: FilaCierre = {
      zoneLevel,
      zoneKey: String(row.codigo ?? row.zoneKey ?? "").trim(),
      mainType,
      ppm2: numero(row.eur_m2 ?? row.precio_m2 ?? row.ppm2),
      transactions: numero(row.compraventas ?? row.total_informados ?? row.transactions),
      surface: surfaceRaw == null || surfaceRaw === "" ? null : numero(surfaceRaw),
      estimated: estimadoDe(row),
      period: periodoDe(row.period, period),
    };
    if (filaAceptable(fila)) salida.push(fila);
  }
  return salida;
}

function estadisticaDe(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const nivel1 = body as { data?: unknown; statistics?: unknown };
  const data = nivel1.data && typeof nivel1.data === "object" ? (nivel1.data as { statistics?: unknown; data?: unknown }) : null;
  const anidada = data?.data && typeof data.data === "object" ? (data.data as { statistics?: unknown }) : null;
  const statistics = anidada?.statistics ?? data?.statistics ?? nivel1.statistics;
  return statistics && typeof statistics === "object" ? (statistics as Record<string, unknown>) : null;
}

/** Una respuesta de `/private/statistics`. Null si no hay precio o la muestra no vale. */
export function filaDesdeEstadistica(input: {
  zoneLevel: NivelNotariado;
  zoneKey: string;
  mainType: TipoNotariado;
  body: unknown;
  period: string;
}): FilaCierre | null {
  const statistics = estadisticaDe(input.body);
  if (!statistics) return null;
  const fila: FilaCierre = {
    zoneLevel: input.zoneLevel,
    zoneKey: input.zoneKey.trim(),
    mainType: input.mainType,
    ppm2: numero(statistics.currentPricePerSqm ?? statistics.pricePerSqm ?? statistics.precio_m2),
    transactions: numero(statistics.currentNumberOfSales ?? statistics.numberOfSales ?? statistics.total_informados),
    surface: (() => {
      const raw = statistics.currentAverageAreaSqm ?? statistics.superficie_media;
      return raw == null ? null : numero(raw);
    })(),
    estimated: estimadoDe(statistics),
    period: periodoDe(statistics.lastDataUpdate, input.period),
  };
  return filaAceptable(fila) ? fila : null;
}

export function textoCierre(
  sources: { layer: string; source: string }[],
  explanation: string[],
): { valor: string; pie: string } {
  const capa = sources.find((s) => s.layer === "close_series");
  const linea = explanation.find((l) => l.includes("Descuento oferta"));
  const cifra = linea?.match(/(\d+(?:[.,]\d+)?)\s*%/)?.[1];
  const valor = cifra ? `${cifra.replace(".", ",")} %` : null;
  if (capa?.source === "market_discount") {
    return { valor: valor ?? "—", pie: "cierre notarial de la zona" };
  }
  return { valor: valor ?? "8 %", pie: "8 % de respaldo, sin cierre notarial" };
}
