/**
 * "Referencia oficial" de una valoración: compara el €/m² estimado con el
 * valor tasado medio del Ministerio y añade el pulso del mercado
 * (compraventas del municipio e IPV del INE) como puntos a favor / en contra.
 *
 * Es informativa: no cambia el precio. Solo resta confianza si la estimación
 * se aleja mucho del tasado oficial, y sirve de mercado de respaldo cuando el
 * municipio aún no tiene anuncios.
 */
import type { OfficialReference, OfficialPoint, ZoneStats } from "../types";
import { nombreProvincia } from "./territorio";

/** Fila de `market_close_series` tal como llega de Supabase. */
export interface FilaCierre {
  source: string;
  zone_level: string;
  zone_key: string;
  period: string;
  ppm2: number | string | null;
  index_value: number | string | null;
  transactions: number | string | null;
  raw: Record<string, unknown> | null;
}

/** Más allá de esto, la estimación "no cuadra" con el tasado y se avisa. */
export const UMBRAL_EN_LINEA_PCT = 20;
/** Más allá de esto, además, se resta confianza. */
export const UMBRAL_PENALIZA_PCT = 50;
/** Un tasado de hace más de 4 trimestres respecto al último publicado no se usa. */
const MAX_TRIMESTRES_ATRAS = 4;

const n = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

const pct = (a: number, b: number) => Math.round(((a - b) / b) * 1000) / 10;
const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
const fmtEur = (v: number) => `${Math.round(v).toLocaleString("es-ES")} €/m²`;

export function etiquetaTrimestre(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${Math.floor((mes - 1) / 3) + 1}T ${anio}`;
}

function haceUnAnio(periodo: string): string {
  const [anio, mes] = periodo.split("-");
  return `${Number(anio) - 1}-${mes}-01`;
}

function trimestresEntre(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return Math.round(((ya - yb) * 12 + (ma - mb)) / 3);
}

export interface ContextoReferencia {
  municipalityCode: string | null;
  /** €/m² de la valoración; null si aún no se conoce (respaldo de mercado). */
  subjectPpm2: number | null;
  /** Nombre del municipio para los textos, si no viene en las series. */
  municipio?: string | null;
}

export function buildOfficialReference(filas: FilaCierre[], ctx: ContextoReferencia): OfficialReference | null {
  const muni = ctx.municipalityCode?.replace(/\D/g, "").padStart(5, "0") ?? null;
  const prov = muni?.slice(0, 2) ?? null;
  const de = (source: string, level: string, key: string | null) =>
    key == null ? [] : filas.filter((f) => f.source === source && f.zone_level === level && f.zone_key === key)
      .sort((a, b) => (a.period < b.period ? 1 : -1));

  // ── Valor tasado: municipio → provincia → España
  const ultimoPublicado = filas.filter((f) => f.source === "mivau_tasado").map((f) => f.period).sort().pop() ?? null;
  const niveles: { level: "municipality" | "province" | "country"; key: string | null }[] = [
    { level: "municipality", key: muni },
    { level: "province", key: prov },
    { level: "country", key: "ES" },
  ];
  let tasado: OfficialReference["tasado"] = null;
  for (const { level, key } of niveles) {
    const serie = de("mivau_tasado", level, key);
    const ultimo = serie[0];
    const ppm2 = n(ultimo?.ppm2);
    if (!ultimo || ppm2 == null) continue;
    if (ultimoPublicado && trimestresEntre(ultimoPublicado, ultimo.period) > MAX_TRIMESTRES_ATRAS) continue;
    const anterior = serie.find((f) => f.period === haceUnAnio(ultimo.period));
    const ppm2Anterior = n(anterior?.ppm2);
    const nombre = String(ultimo.raw?.nombre ?? "").trim();
    const label =
      level === "municipality" ? nombre || ctx.municipio || `municipio ${key}`
      : level === "province" ? `provincia de ${nombreProvincia(key!) ?? key}`
      : "España";
    tasado = {
      level,
      zoneKey: key!,
      label,
      period: ultimo.period.slice(0, 10),
      ppm2,
      tasaciones: n(ultimo.transactions),
      yoyPct: ppm2Anterior ? pct(ppm2, ppm2Anterior) : null,
    };
    break;
  }

  // ── Compraventas del municipio (últimos 4 trimestres frente a los 4 anteriores)
  let transacciones: OfficialReference["transacciones"] = null;
  const tx = de("mivau_transacciones", "municipality", muni);
  if (tx.length >= 4) {
    const suma = (xs: FilaCierre[]) => xs.reduce((a, f) => a + (n(f.transactions) ?? 0), 0);
    const ult = suma(tx.slice(0, 4));
    const prev = tx.length >= 8 ? suma(tx.slice(4, 8)) : null;
    transacciones = {
      ultimos12m: ult,
      previos12m: prev,
      variacionPct: prev ? pct(ult, prev) : null,
      hasta: tx[0].period.slice(0, 10),
      municipio: String(tx[0].raw?.nombre ?? ctx.municipio ?? "").trim() || null,
    };
  }

  // ── IPV del INE (comunidad, o España si no hay)
  let ipv: OfficialReference["ipv"] = null;
  const serieIpv = de("ine_ipv", "province", prov).length ? de("ine_ipv", "province", prov) : de("ine_ipv", "country", "ES");
  const ultIpv = serieIpv.find((f) => n(f.raw?.anualPct) != null);
  if (ultIpv) {
    ipv = {
      ambito: String(ultIpv.raw?.ambito ?? "España"),
      period: ultIpv.period.slice(0, 10),
      anualPct: n(ultIpv.raw?.anualPct)!,
      segundaManoAnualPct: n(ultIpv.raw?.segundaManoAnualPct),
    };
  }

  if (!tasado && !transacciones && !ipv) return null;

  const desviacionPct = tasado && ctx.subjectPpm2 ? pct(ctx.subjectPpm2, tasado.ppm2) : null;
  const lectura: OfficialReference["lectura"] =
    desviacionPct == null ? null
    : Math.abs(desviacionPct) <= UMBRAL_EN_LINEA_PCT ? "en_linea"
    : desviacionPct > 0 ? "por_encima" : "por_debajo";

  const puntos: OfficialPoint[] = [];
  if (tasado && desviacionPct != null) {
    const base = `valor tasado medio de ${tasado.label} (${fmtEur(tasado.ppm2)}, ${etiquetaTrimestre(tasado.period)})`;
    puntos.push({
      indicator: "tasado_desviacion",
      sense: lectura === "en_linea" ? "positive" : "info",
      text: lectura === "en_linea"
        ? `El €/m² estimado está en línea con el ${base}: ${fmtPct(desviacionPct)}.`
        : `El €/m² estimado está un ${Math.abs(desviacionPct).toLocaleString("es-ES", { maximumFractionDigits: 1 })} % ${desviacionPct > 0 ? "por encima" : "por debajo"} del ${base}.${tasado.level !== "municipality" ? " La referencia es de ámbito amplio: es normal que una zona concreta se separe." : Math.abs(desviacionPct) > UMBRAL_PENALIZA_PCT ? " Conviene revisar los comparables." : ""}`,
    });
  }
  if (tasado?.yoyPct != null) {
    puntos.push({
      indicator: "tasado_tendencia",
      sense: tasado.yoyPct >= 3 ? "positive" : tasado.yoyPct <= -1 ? "negative" : "info",
      text: `Valor tasado de ${tasado.label}: ${fmtPct(tasado.yoyPct)} en un año.`,
    });
  }
  if (transacciones) {
    const quien = transacciones.municipio ?? "el municipio";
    const v = transacciones.variacionPct;
    puntos.push({
      indicator: "compraventas",
      sense: v == null ? "info" : v >= 5 ? "positive" : v <= -5 ? "negative" : "info",
      text: `${transacciones.ultimos12m.toLocaleString("es-ES")} compraventas de vivienda en ${quien} en el último año${v != null ? ` (${fmtPct(v)} frente al anterior)` : ""}.`,
    });
  }
  if (ipv) {
    puntos.push({
      indicator: "ipv",
      sense: ipv.anualPct >= 3 ? "positive" : ipv.anualPct <= -1 ? "negative" : "info",
      text: `Precio de compraventa en ${ipv.ambito}: ${fmtPct(ipv.anualPct)} interanual (IPV del INE, ${etiquetaTrimestre(ipv.period)})${ipv.segundaManoAnualPct != null ? `; segunda mano ${fmtPct(ipv.segundaManoAnualPct)}` : ""}.`,
    });
  }

  const fuentes: string[] = [];
  if (tasado || transacciones) fuentes.push("Ministerio de Vivienda y Agenda Urbana, Boletín estadístico (valor tasado y transacciones)");
  if (ipv) fuentes.push("INE, Índice de Precios de Vivienda (tabla 25171)");

  return { tasado, transacciones, ipv, subjectPpm2: ctx.subjectPpm2, desviacionPct, lectura, puntos, fuentes };
}

/** Mercado de respaldo cuando el municipio no tiene anuncios: el tasado oficial. */
export function zoneStatsDesdeReferencia(ref: OfficialReference | null): ZoneStats | null {
  const t = ref?.tasado;
  if (!t) return null;
  return {
    zoneLevel: t.level,
    zoneKey: t.zoneKey,
    label: `Valor tasado oficial · ${t.label}`,
    month: t.period,
    n: t.tasaciones ?? 0,
    medianPpm2: t.ppm2,
    p25Ppm2: null,
    p75Ppm2: null,
    trend12mPct: t.yoyPct,
    source: "official_series",
  };
}

/** Líneas para `explanation`. */
export function explicacionOficial(ref: OfficialReference | null): string[] {
  if (!ref) return [];
  const p = ref.puntos.find((x) => x.indicator === "tasado_desviacion");
  return p ? [`Referencia oficial: ${p.text}`] : [];
}
