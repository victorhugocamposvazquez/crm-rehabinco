/**
 * Criminalidad municipal (Ministerio del Interior, >20k hab.)
 *
 * npx tsx scripts/env-load/crime.ts --csv data/env/crime/balance.csv
 *
 * CSV: municipality_code,period,rate_per_1000,peer_avg
 */
import { readFileSync } from "node:fs";
import { adminClient } from "./_shared";

const LOADED_AT = new Date().toISOString();

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main(): Promise<void> {
  const file = arg("--csv");
  if (!file) {
    console.error("Pasa --csv con el balance trimestral (15030 = A Coruña).");
    process.exit(1);
  }
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const filas = lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      municipality_code: cols[idx("municipality_code")]?.trim(),
      period: cols[idx("period")]?.trim(),
      rate_per_1000: Number(cols[idx("rate_per_1000")]),
      peer_avg: cols[idx("peer_avg")] ? Number(cols[idx("peer_avg")]) : null,
      loaded_at: LOADED_AT,
    };
  }).filter((r) => r.municipality_code && r.period);

  const db = await adminClient();
  const { error: delErr } = await db.from("crime_stats").delete().neq("municipality_code", "");
  if (delErr) throw new Error(delErr.message);
  const { error } = await db.from("crime_stats").insert(filas);
  if (error) throw new Error(error.message);
  console.log(`Criminalidad: ${filas.length} filas`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
