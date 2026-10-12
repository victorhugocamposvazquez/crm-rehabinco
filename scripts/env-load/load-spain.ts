/**
 * Carga de entorno AVM para toda España (orden recomendado).
 *
 * npx tsx scripts/env-load/load-spain.ts
 * npx tsx scripts/env-load/load-spain.ts --skip-osm
 *
 * OSM: 1–3 h según CPU y red (~1,2 GB PBF + osmium).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(script: string, args: string): void {
  const cmd = `npx tsx ${path.join(root, "scripts/env-load", script)} ${args}`.trim();
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env });
}

function main(): void {
  const skipOsm = process.argv.includes("--skip-osm");
  console.log("=== Entorno AVM · España ===");

  run("crime.ts", "--fetch");
  run("vulnerability.ts", "--fetch-spain");

  if (!skipOsm) {
    run("osm.ts", "--region spain");
  } else {
    console.log("\n(Omitido OSM por --skip-osm)\n");
  }

  console.log("\n=== Fin. Revalora inmuebles para refrescar el snapshot de entorno. ===\n");
}

main();
