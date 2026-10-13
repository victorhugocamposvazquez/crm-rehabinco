/**
 * Criminalidad municipal (Ministerio del Interior, >20k hab.)
 *
 * npx tsx scripts/env-load/crime.ts --fetch
 * npx tsx scripts/env-load/crime.ts --csv data/env/crime/balance.csv
 *
 * CSV manual: municipality_code,period,rate_per_1000,peer_avg
 */
import { readFileSync } from "node:fs";
import { bandaPoblacion, tasaPorMil } from "../../lib/avm/crime-rate";
import { adminClient, dataDir } from "./_shared";

const LOADED_AT = new Date().toISOString();
const FETCH_URL = "https://www.datoscrimen.es/data/crime_mun_prod.csv";
const TOTAL_TYPE = "Total infracciones penales";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function normMuni(code: string): string {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(5, "0").slice(-5);
}

type CrimeRow = {
  municipality_code: string;
  period: string;
  rate_per_1000: number;
  peer_avg: number | null;
  peer_band: string | null;
  population: number | null;
  offenses: number | null;
  loaded_at: string;
};

type Crudo = { period: string; count: number; pop: number; municipality_code: string };

function filasDesdeCrudos(crudos: Crudo[], rechazadas: Rechazo[]): CrimeRow[] {
  const validas: { municipality_code: string; period: string; rate: number; pop: number; count: number; band: string }[] = [];
  for (const row of crudos) {
    const rate = tasaPorMil(row.count, row.pop);
    if (rate == null) {
      const bruta = row.pop > 0 ? (row.count * 1000) / row.pop : null;
      rechazadas.push({
        municipality_code: row.municipality_code,
        period: row.period,
        rate: bruta,
        population: row.pop,
        offenses: row.count,
      });
      continue;
    }
    validas.push({
      municipality_code: row.municipality_code,
      period: row.period,
      rate,
      pop: row.pop,
      count: row.count,
      band: bandaPoblacion(row.pop),
    });
  }

  const porBanda = new Map<string, number[]>();
  for (const v of validas) {
    const lista = porBanda.get(v.band) ?? [];
    lista.push(v.rate);
    porBanda.set(v.band, lista);
  }
  const mediaBanda = new Map<string, number>();
  for (const [band, rates] of porBanda) {
    mediaBanda.set(band, rates.reduce((a, b) => a + b, 0) / rates.length);
  }

  return validas.map((v) => ({
    municipality_code: v.municipality_code,
    period: v.period,
    rate_per_1000: v.rate,
    peer_avg: mediaBanda.get(v.band) ?? null,
    peer_band: v.band,
    population: v.pop,
    offenses: v.count,
    loaded_at: LOADED_AT,
  }));
}

type Rechazo = { municipality_code: string; period: string; rate: number | null; population: number; offenses: number };

async function parseDatosCrimenCsv(text: string): Promise<{ filas: CrimeRow[]; rechazadas: Rechazo[] }> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const byMuniYear = new Map<string, Crudo>();

  for (const line of lines.slice(1)) {
    const cols = line.includes('"') ? parseCsvLine(line) : line.split(",");
    const type = (cols[idx("type")] ?? "").replace(/^"|"$/g, "");
    if (type !== TOTAL_TYPE) continue;
    const year = Number(cols[idx("year")]);
    const mun = normMuni(cols[idx("mun_code")] ?? "");
    const count = Number(cols[idx("count")]);
    const pop = Number(cols[idx("pop")]);
    if (!mun || !Number.isFinite(year) || !Number.isFinite(count) || !Number.isFinite(pop)) continue;
    const prev = byMuniYear.get(mun);
    if (!prev || year > Number(prev.period)) byMuniYear.set(mun, { period: String(year), count, pop, municipality_code: mun });
  }

  const rechazadas: Rechazo[] = [];
  return { filas: filasDesdeCrudos([...byMuniYear.values()], rechazadas), rechazadas };
}

/** CSV con comillas y campos con comas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

async function fetchCsv(dest: string): Promise<string> {
  console.log(`Descargando ${FETCH_URL}…`);
  const res = await fetch(FETCH_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFileSync } = await import("node:fs");
  writeFileSync(dest, buf);
  return buf.toString("utf8");
}

async function registrarRechazos(rechazadas: Rechazo[]): Promise<void> {
  if (!rechazadas.length) return;
  const db = await adminClient();
  const filas = rechazadas.map((r) => ({
    kind: "crime_rate_out_of_range",
    layer: "crime_municipality",
    municipality_code: r.municipality_code,
    message: `Tasa de criminalidad fuera de 0–200 (${r.rate ?? "sin tasa"}) en ${r.municipality_code}, periodo ${r.period}. No se muestra.`,
    payload: r,
  }));
  const { error } = await db.from("avm_alerts").insert(filas);
  if (error) throw new Error(error.message);
  console.log(`Criminalidad: ${rechazadas.length} municipios fuera de 0–200, registrados en avm_alerts`);
}

async function insertFilas(filas: CrimeRow[], rechazadas: Rechazo[]): Promise<void> {
  const db = await adminClient();
  const { error: delErr } = await db.from("crime_stats").delete().neq("municipality_code", "");
  if (delErr) throw new Error(delErr.message);
  const chunk = 500;
  for (let i = 0; i < filas.length; i += chunk) {
    const { error } = await db.from("crime_stats").insert(filas.slice(i, i + chunk));
    if (error) throw new Error(error.message);
  }
  await registrarRechazos(rechazadas);
  console.log(`Criminalidad: ${filas.length} municipios (último año disponible por municipio)`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--fetch")) {
    const dest = dataDir("crime") + "/crime_mun_prod.csv";
    const text = await fetchCsv(dest);
    const { filas, rechazadas } = await parseDatosCrimenCsv(text);
    await insertFilas(filas, rechazadas);
    return;
  }

  const file = arg("--csv");
  if (!file) {
    console.error("Pasa --fetch (España, datoscrimen.es) o --csv con el balance trimestral.");
    process.exit(1);
  }
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const rechazadas: Rechazo[] = [];
  const crudos: Crudo[] = [];
  const manuales: CrimeRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const mun = normMuni(cols[idx("municipality_code")]?.trim() ?? "");
    const period = cols[idx("period")]?.trim() ?? "";
    const pop = Number(cols[idx("population")] ?? cols[idx("pop")]);
    const count = Number(cols[idx("offenses")] ?? cols[idx("count")]);
    if (!mun || !period) continue;
    if (Number.isFinite(pop) && pop > 0 && Number.isFinite(count)) {
      crudos.push({ period, count, pop, municipality_code: mun });
      continue;
    }
    const rate = Number(cols[idx("rate_per_1000")]);
    if (!Number.isFinite(rate) || rate < 0 || rate > 200) {
      rechazadas.push({ municipality_code: mun, period, rate: Number.isFinite(rate) ? rate : null, population: Number.isFinite(pop) ? pop : 0, offenses: Number.isFinite(count) ? count : 0 });
      continue;
    }
    manuales.push({
      municipality_code: mun,
      period,
      rate_per_1000: rate,
      peer_avg: cols[idx("peer_avg")] ? Number(cols[idx("peer_avg")]) : null,
      peer_band: cols[idx("peer_band")]?.trim() || null,
      population: Number.isFinite(pop) ? pop : null,
      offenses: Number.isFinite(count) ? count : null,
      loaded_at: LOADED_AT,
    });
  }
  await insertFilas([...filasDesdeCrudos(crudos, rechazadas), ...manuales], rechazadas);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
