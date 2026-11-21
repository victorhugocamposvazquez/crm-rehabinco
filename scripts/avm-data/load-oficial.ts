/**
 * Series oficiales → market_close_series (toda España)
 *
 *  - Valor tasado medio de vivienda libre (MIVAU): España y provincias; municipios > 25.000 hab.
 *  - Compraventas de vivienda por municipio (MIVAU, a partir de los datos notariales).
 *  - Índice de Precios de Vivienda (INE, tabla 25171), por comunidad.
 *
 * npx tsx scripts/avm-data/load-oficial.ts            # todo
 * npx tsx scripts/avm-data/load-oficial.ts --desde 2022-01-01
 * npx tsx scripts/avm-data/load-oficial.ts --dry-run  # solo cuenta, no escribe
 *
 * Cada fuente se sustituye entera (borrar + insertar) dentro del rango cargado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../env-load/_shared";
import { leerXls } from "../../lib/avm/oficial/xls";
import {
  URLS_MIVAU,
  parseTasadoMunicipios,
  parseTasadoProvincias,
  parseTransaccionesMunicipios,
} from "../../lib/avm/oficial/mivau";
import { URL_IPV, parseIpv, type SerieIne } from "../../lib/avm/oficial/ine-ipv";
import {
  filasIpv,
  filasTasadoMunicipios,
  filasTasadoTerritorio,
  filasTransacciones,
  type FilaSerieCierre,
  type FuenteOficial,
} from "../../lib/avm/oficial/filas";
import { CatalogoMunicipios, type MunicipioCatalogo } from "../../lib/avm/oficial/territorio";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function descargar(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function catalogo(db: SupabaseClient): Promise<CatalogoMunicipios> {
  const municipios: MunicipioCatalogo[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from("catastro_municipios")
      .select("ine_code, name_catastro, name_ine")
      .order("ine_code")
      .range(desde, desde + 999);
    if (error) throw new Error(`catastro_municipios: ${error.message}`);
    for (const m of data ?? []) {
      municipios.push({ ine: String(m.ine_code), nombres: [m.name_ine, m.name_catastro].filter(Boolean) as string[] });
    }
    if (!data || data.length < 1000) break;
  }
  if (municipios.length < 7000) {
    throw new Error(`catastro_municipios solo tiene ${municipios.length} municipios: carga antes el catálogo nacional.`);
  }
  return new CatalogoMunicipios(municipios);
}

async function sustituir(db: SupabaseClient, source: FuenteOficial, desde: string, filas: FilaSerieCierre[]): Promise<void> {
  const { error } = await db.from("market_close_series").delete().eq("source", source).gte("period", desde);
  if (error) throw new Error(`borrar ${source}: ${error.message}`);
  for (let i = 0; i < filas.length; i += 1000) {
    const { error: e } = await db.from("market_close_series").insert(filas.slice(i, i + 1000));
    if (e) throw new Error(`insertar ${source}: ${e.message}`);
  }
}

export async function cargarSeriesOficiales(opts: { desde?: string; dryRun?: boolean } = {}): Promise<{ rows: number }> {
  const desde = opts.desde ?? `${new Date().getFullYear() - 3}-01-01`;
  const db = await adminClient();
  const cat = await catalogo(db);

  console.log("↓ Valor tasado por provincias…");
  const tasProv = filasTasadoTerritorio(parseTasadoProvincias(leerXls(await descargar(URLS_MIVAU.tasadoProvincias))))
    .filter((f) => f.period >= desde);

  console.log("↓ Valor tasado por municipios…");
  const hojasMuni = leerXls(await descargar(URLS_MIVAU.tasadoMunicipios));
  const tasMuni = filasTasadoMunicipios(hojasMuni.flatMap(parseTasadoMunicipios).filter((f) => f.periodo >= desde), cat);

  console.log("↓ Compraventas por municipio…");
  const [hojaTx] = leerXls(await descargar(URLS_MIVAU.transaccionesMunicipios));
  const tx = filasTransacciones(parseTransaccionesMunicipios(hojaTx, desde), cat);

  console.log("↓ IPV (INE)…");
  const ipvRes = await fetch(URL_IPV(16), { signal: AbortSignal.timeout(60_000) });
  if (!ipvRes.ok) throw new Error(`INE IPV: HTTP ${ipvRes.status}`);
  const ipv = filasIpv(parseIpv((await ipvRes.json()) as SerieIne[])).filter((f) => f.period >= desde);

  const tasado = [...tasProv, ...tasMuni.filas];
  console.log(`  tasado: ${tasProv.length} filas de territorio, ${tasMuni.filas.length} de municipio (sin casar: ${tasMuni.sinCasar.length})`);
  console.log(`  compraventas: ${tx.filas.length} filas (sin casar: ${tx.sinCasar.length})`);
  console.log(`  IPV: ${ipv.length} filas`);
  for (const s of [...tasMuni.sinCasar, ...tx.sinCasar].slice(0, 40)) console.log(`    ? ${s}`);

  if (tasado.length < 100 || tx.filas.length < 1000) {
    throw new Error("Muy pocas filas: el formato del Ministerio puede haber cambiado. No se escribe nada.");
  }
  if (!opts.dryRun) {
    await sustituir(db, "mivau_tasado", desde, tasado);
    await sustituir(db, "mivau_transacciones", desde, tx.filas);
    if (ipv.length) await sustituir(db, "ine_ipv", desde, ipv);
  }
  return { rows: tasado.length + tx.filas.length + ipv.length };
}

const esDirecto = process.argv[1]?.endsWith("load-oficial.ts");
if (esDirecto) {
  cargarSeriesOficiales({ desde: arg("--desde") ?? undefined, dryRun: process.argv.includes("--dry-run") })
    .then(({ rows }) => console.log(`✓ series oficiales: ${rows} filas`))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
