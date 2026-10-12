/**
 * Carga de entorno AVM para toda España (orden recomendado).
 *
 * npx tsx scripts/env-load/load-spain.ts
 * npx tsx scripts/env-load/load-spain.ts --skip-osm
 * npx tsx scripts/env-load/load-spain.ts --full
 * npx tsx scripts/env-load/load-spain.ts --with-flood --with-noise --skip-osm
 *
 * OSM: 1–3 h · SNCZI T10 ~800 MB · MER aglomeraciones ~250 MB (brew install gdal).
 * GTFS/NAP no se incluye (requiere API key).
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
  const full = process.argv.includes("--full");
  const skipOsm = process.argv.includes("--skip-osm");
  const withFlood = full || process.argv.includes("--with-flood");
  const withNoise = full || process.argv.includes("--with-noise");
  const floodArgs = process.argv.includes("--skip-t10") ? "--fetch-spain --skip-t10" : "--fetch-spain";
  console.log("=== Entorno AVM · España ===");

  run("crime.ts", "--fetch");
  run("vulnerability.ts", "--fetch-spain");

  if (withFlood) {
    run("sncsi.ts", floodArgs);
  }
  if (withNoise) {
    run("noise.ts", "--fetch-spain");
  }

  if (!skipOsm) {
    run("osm.ts", "--region spain");
  } else {
    console.log("\n(Omitido OSM por --skip-osm)\n");
  }

  if (!withFlood || !withNoise) {
    console.log(
      "\nTip: añade --with-flood y --with-noise (GDAL) para SNCZI + MER. GTFS/NAP queda fuera sin API key.\n",
    );
  }

  console.log("\n=== Fin. Revalora inmuebles para refrescar el snapshot de entorno. ===\n");
}

main();
