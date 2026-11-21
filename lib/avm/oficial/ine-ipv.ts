/**
 * Índice de Precios de Vivienda (IPV) del INE, tabla 25171: índice y
 * variaciones por comunidad autónoma y trimestre. Se basa en precios de
 * compraventa escriturados (Consejo General del Notariado), así que es la
 * mejor señal pública de tendencia de precios de cierre.
 *
 * API JSON pública: https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/25171?nult=N
 */
import { inicioTrimestre } from "./mivau";
import { codigoCcaa } from "./territorio";

/** En la API del INE los trimestres son FK_Periodo 19 (T1) a 22 (T4). */
export function inicioTrimestreDesdeIne(anio: number, fkPeriodo: number): string | null {
  const t = fkPeriodo - 18;
  return t >= 1 && t <= 4 ? inicioTrimestre(anio, t) : null;
}

export const URL_IPV = (ultimos = 8) => `https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/25171?nult=${ultimos}`;

export interface SerieIne {
  COD: string;
  Nombre: string;
  Data: { FK_Periodo: number; Anyo: number; Valor: number | null }[];
}

export type TipoIpv = "general" | "nueva" | "segunda_mano";

export interface IpvTrimestre {
  ambito: "pais" | "ccaa";
  codigo: string;              // "ES" o código de comunidad
  periodo: string;             // "YYYY-MM-01"
  tipo: TipoIpv;
  indice: number | null;
  anualPct: number | null;
}

const TIPOS: Record<string, TipoIpv> = {
  general: "general",
  "vivienda nueva": "nueva",
  "vivienda segunda mano": "segunda_mano",
};

export function parseIpv(series: SerieIne[]): IpvTrimestre[] {
  const out = new Map<string, IpvTrimestre>();
  for (const s of series) {
    const partes = s.Nombre.split(". ").map((p) => p.replace(/\.\s*$/, "").trim()).filter(Boolean);
    if (partes.length < 3) continue;
    const [territorio, tipoTxt, medida] = partes;
    const tipo = TIPOS[tipoTxt.toLowerCase()];
    if (!tipo) continue;
    const esIndice = /^índice$/i.test(medida);
    const esAnual = /^variación anual$/i.test(medida);
    if (!esIndice && !esAnual) continue;
    const ambito = /^nacional$/i.test(territorio) ? "pais" : "ccaa";
    const codigo = ambito === "pais" ? "ES" : codigoCcaa(territorio);
    if (!codigo) continue;
    for (const d of s.Data) {
      const periodo = inicioTrimestreDesdeIne(d.Anyo, d.FK_Periodo);
      if (!periodo || d.Valor == null) continue;
      const clave = `${ambito}:${codigo}:${tipo}:${periodo}`;
      const fila = out.get(clave) ?? { ambito, codigo, periodo, tipo, indice: null, anualPct: null };
      if (esIndice) fila.indice = d.Valor;
      else fila.anualPct = d.Valor;
      out.set(clave, fila);
    }
  }
  return [...out.values()];
}
