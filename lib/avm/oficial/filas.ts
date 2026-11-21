/**
 * Convierte las series oficiales ya interpretadas en filas de `market_close_series`.
 *
 *  source               zone_level             ppm2 / index_value / transactions
 *  mivau_tasado         country/province/muni  €/m² tasado · — · nº de tasaciones (muni)
 *  mivau_transacciones  municipality           — · — · compraventas del trimestre
 *  ine_ipv              country/province       — · índice general · —  (raw: variaciones)
 *
 * El IPV es por comunidad: se repite en cada provincia para poder buscarlo por
 * el código de provincia del inmueble.
 */
import type { IpvTrimestre } from "./ine-ipv";
import type { TasadoMunicipio, TasadoTerritorio, TransaccionesMunicipio } from "./mivau";
import { type CatalogoMunicipios, nombreCcaa, provinciasDeCcaa } from "./territorio";

export type FuenteOficial = "mivau_tasado" | "mivau_transacciones" | "ine_ipv";

export interface FilaSerieCierre {
  source: FuenteOficial;
  zone_level: "municipality" | "province" | "country";
  zone_key: string;
  main_type: null;
  period: string;
  ppm2: number | null;
  index_value: number | null;
  transactions: number | null;
  raw: Record<string, unknown>;
}

const base = { main_type: null, ppm2: null, index_value: null, transactions: null } as const;

export function filasTasadoTerritorio(filas: TasadoTerritorio[]): FilaSerieCierre[] {
  return filas
    .filter((f) => f.ambito !== "ccaa")
    .map((f) => ({
      ...base,
      source: "mivau_tasado" as const,
      zone_level: f.ambito === "pais" ? ("country" as const) : ("province" as const),
      zone_key: f.codigo,
      period: f.periodo,
      ppm2: f.ppm2,
      raw: { nombre: f.nombre },
    }));
}

export interface ResultadoCasado { filas: FilaSerieCierre[]; sinCasar: string[] }

export function filasTasadoMunicipios(filas: TasadoMunicipio[], catalogo: CatalogoMunicipios): ResultadoCasado {
  const out = new Map<string, FilaSerieCierre>();
  const sinCasar = new Set<string>();
  for (const f of filas) {
    const ine = catalogo.resolver(f.municipio, f.provinciaPista);
    if (!ine) { sinCasar.add(`${f.provinciaPista ?? "??"} ${f.municipio}`); continue; }
    out.set(`${ine}:${f.periodo}`, {
      ...base,
      source: "mivau_tasado",
      zone_level: "municipality",
      zone_key: ine,
      period: f.periodo,
      ppm2: f.ppm2,
      transactions: f.tasaciones,
      raw: { nombre: f.municipio, ppm2Hasta5: f.ppm2Hasta5, ppm2Mas5: f.ppm2Mas5 },
    });
  }
  return { filas: [...out.values()], sinCasar: [...sinCasar] };
}

export function filasTransacciones(filas: TransaccionesMunicipio[], catalogo: CatalogoMunicipios): ResultadoCasado {
  const out = new Map<string, FilaSerieCierre>();
  const sinCasar = new Set<string>();
  const cache = new Map<string, string | null>();
  for (const f of filas) {
    const k = `${f.provincia}|${f.municipio}`;
    if (!cache.has(k)) cache.set(k, catalogo.resolverEnProvincia(f.municipio, f.provincia));
    const ine = cache.get(k);
    if (!ine) { sinCasar.add(`${f.provincia} ${f.municipio}`); continue; }
    out.set(`${ine}:${f.periodo}`, {
      ...base,
      source: "mivau_transacciones",
      zone_level: "municipality",
      zone_key: ine,
      period: f.periodo,
      transactions: f.n,
      raw: { nombre: f.municipio },
    });
  }
  return { filas: [...out.values()], sinCasar: [...sinCasar] };
}

export function filasIpv(filas: IpvTrimestre[]): FilaSerieCierre[] {
  const grupos = new Map<string, { ambito: IpvTrimestre["ambito"]; codigo: string; periodo: string; por: Partial<Record<IpvTrimestre["tipo"], IpvTrimestre>> }>();
  for (const f of filas) {
    const k = `${f.ambito}:${f.codigo}:${f.periodo}`;
    const g = grupos.get(k) ?? { ambito: f.ambito, codigo: f.codigo, periodo: f.periodo, por: {} };
    g.por[f.tipo] = f;
    grupos.set(k, g);
  }
  const out: FilaSerieCierre[] = [];
  for (const g of grupos.values()) {
    const general = g.por.general;
    if (!general) continue;
    const raw = {
      ambito: g.ambito === "pais" ? "España" : nombreCcaa(g.codigo),
      ccaa: g.ambito === "pais" ? null : g.codigo,
      anualPct: general.anualPct,
      segundaManoAnualPct: g.por.segunda_mano?.anualPct ?? null,
      nuevaAnualPct: g.por.nueva?.anualPct ?? null,
    };
    const claves = g.ambito === "pais" ? ["ES"] : provinciasDeCcaa(g.codigo);
    for (const zone_key of claves) {
      out.push({
        ...base,
        source: "ine_ipv",
        zone_level: g.ambito === "pais" ? "country" : "province",
        zone_key,
        period: g.periodo,
        index_value: general.indice,
        raw,
      });
    }
  }
  return out;
}
