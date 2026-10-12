/**
 * Orquestador CI / manual de cargas AVM.
 *
 * npx tsx scripts/avm-data/run.ts --layer crime --scope all
 * npx tsx scripts/avm-data/run.ts --layer osm --scope spain/galicia
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGeofabrikScope } from "./geofabrik";
import { withAvmDataJob } from "./job-log";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  return (i >= 0 ? process.argv[i + 1] : "")?.trim() ?? "";
}

function sh(cmd: string): void {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env });
}

async function main(): Promise<void> {
  const layer = arg("--layer") || process.env.AVM_DATA_LAYER || "";
  const scope = resolveGeofabrikScope(arg("--scope") || process.env.AVM_DATA_SCOPE || "spain");

  if (!layer) {
    console.error("Pasa --layer: osm|gtfs|crime|vulnerability|snczi|noise|ine_sections|inspire");
    process.exit(1);
  }

  const { rows } = await withAvmDataJob(layer, scope, async () => {
    switch (layer) {
      case "crime":
        sh("npx tsx scripts/env-load/crime.ts --fetch");
        return { rows: 0 };
      case "vulnerability":
        sh("npx tsx scripts/env-load/vulnerability.ts --fetch-spain");
        return { rows: 0 };
      case "snczi":
        sh("npx tsx scripts/env-load/sncsi.ts --fetch-spain --skip-t10");
        return { rows: 0 };
      case "noise":
        sh("npx tsx scripts/env-load/noise.ts --fetch-spain");
        return { rows: 0 };
      case "osm": {
        process.env.AVM_GEOFABRIK_SCOPE = scope;
        sh(`npx tsx scripts/env-load/osm.ts --geofabrik ${scope}`);
        return { rows: 0 };
      }
      case "gtfs": {
        const zip = process.env.GTFS_STOPS_DIR ?? "data/env/gtfs/tranvias-coruna";
        sh(`npx tsx scripts/env-load/gtfs.ts --zip ${zip}`);
        return { rows: 0 };
      }
      case "ine_sections":
        sh("npx tsx scripts/avm-data/load-ine-sections.ts");
        return { rows: Number(process.env.AVM_LAST_ROWS ?? 0) };
      case "inspire":
        sh(`npx tsx scripts/avm-data/load-inspire.ts --scope ${scope}`);
        return { rows: Number(process.env.AVM_LAST_ROWS ?? 0) };
      default:
        throw new Error(`Capa desconocida: ${layer}`);
    }
  });

  console.log(`\n✓ ${layer} (${scope}) · filas registradas: ${rows}\n`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
