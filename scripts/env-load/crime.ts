/**
 * Criminalidad municipal (Ministerio del Interior, >20k hab.)
 *
 * npx tsx scripts/env-load/crime.ts --fetch
 * npx tsx scripts/env-load/crime.ts --csv data/env/crime/balance.csv
 *
 * CSV manual: municipality_code,period,rate_per_1000,peer_avg
 */
import { readFileSync } from "node:fs";
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
  loaded_at: string;
};

async function parseDatosCrimenCsv(text: string): Promise<CrimeRow[]> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const byMuniYear = new Map<string, { year: number; rate100k: number; pop: number }>();

  for (const line of lines.slice(1)) {
    const cols = line.includes('"') ? parseCsvLine(line) : line.split(",");
    const type = (cols[idx("type")] ?? "").replace(/^"|"$/g, "");
    if (type !== TOTAL_TYPE) continue;
    const year = Number(cols[idx("year")]);
    const mun = normMuni(cols[idx("mun_code")] ?? "");
    const rate100k = Number(cols[idx("rate")]);
    if (!mun || !Number.isFinite(year) || !Number.isFinite(rate100k)) continue;
    const prev = byMuniYear.get(mun);
    if (!prev || year > prev.year) {
      byMuniYear.set(mun, { year, rate100k, pop: Number(cols[idx("pop")]) });
    }
  }

  const rates = [...byMuniYear.values()].map((v) => v.rate100k / 100);
  rates.sort((a, b) => a - b);
  const peerAvg = rates.length ? rates[Math.floor(rates.length / 2)] : null;

  return [...byMuniYear.entries()].map(([municipality_code, v]) => ({
    municipality_code,
    period: String(v.year),
    rate_per_1000: Math.round((v.rate100k / 100) * 1000) / 1000,
    peer_avg: peerAvg,
    loaded_at: LOADED_AT,
  }));
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

async function insertFilas(filas: CrimeRow[]): Promise<void> {
  const db = await adminClient();
  const { error: delErr } = await db.from("crime_stats").delete().neq("municipality_code", "");
  if (delErr) throw new Error(delErr.message);
  const chunk = 500;
  for (let i = 0; i < filas.length; i += chunk) {
    const { error } = await db.from("crime_stats").insert(filas.slice(i, i + chunk));
    if (error) throw new Error(error.message);
  }
  console.log(`Criminalidad: ${filas.length} municipios (último año disponible por municipio)`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--fetch")) {
    const dest = dataDir("crime") + "/crime_mun_prod.csv";
    const text = await fetchCsv(dest);
    const filas = await parseDatosCrimenCsv(text);
    await insertFilas(filas);
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
  const filas = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      municipality_code: normMuni(cols[idx("municipality_code")]?.trim() ?? ""),
      period: cols[idx("period")]?.trim(),
      rate_per_1000: Number(cols[idx("rate_per_1000")]),
      peer_avg: cols[idx("peer_avg")] ? Number(cols[idx("peer_avg")]) : null,
      loaded_at: LOADED_AT,
    };
  }).filter((r) => r.municipality_code && r.period);

  await insertFilas(filas);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
