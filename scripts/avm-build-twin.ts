import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cargarEnv(): void {
  for (const rel of [".env.local", "crawler/.env"]) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      const value = m[2].replace(/^"|"$/g, "");
      if (value) process.env[m[1]] = value;
    }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
  }
}

async function main(): Promise<void> {
  cargarEnv();
  const { buildTwin } = await import("../lib/avm/twin-builder");
  const address = process.argv.slice(2).join(" ") || "Rúa Juan Flórez 30, 15004 A Coruña";
  const out = await buildTwin(
    { address },
    { tenantId: "00000000-0000-4000-8000-000000000001" }
  );
  console.log(
    JSON.stringify(
      {
        ...out,
        prefilledFields: [...out.prefilledFields],
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
