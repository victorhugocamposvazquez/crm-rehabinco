import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TENANT_REHABINCO, valorar } from "../lib/avm/valuate-service";
import { buildTwin } from "../lib/avm/twin-builder";

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

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main(): Promise<void> {
  cargarEnv();
  const address = argumento("--address") ?? "Rúa Juan Flórez 30, 15004 A Coruña";
  const unidad = argumento("--unit");
  const channel = argumento("--channel") === "landing" ? "landing" : "crm";
  const { createAdminClient } = await import("../lib/supabase/admin");
  const admin = createAdminClient();

  let ref: string | undefined;
  if (unidad) {
    const [planta, puerta] = unidad.split("-");
    const previo = await buildTwin({ address }, { tenantId: TENANT_REHABINCO });
    const elegida = previo.units?.find(
      (u) => u.isDwelling && (u.floor === planta || u.floor === planta?.padStart(2, "0")) && u.door === puerta
    );
    if (!elegida) throw new Error(`No hay vivienda ${unidad} en la parcela`);
    ref = elegida.catastralRef;
  }

  const respuesta = await valorar(
    {
      input: { address, catastralRef: ref },
      channel,
      operation: "sale",
      landingSlug: channel === "landing" ? "rehabinco" : undefined,
    },
    { admin, tenantId: channel === "crm" ? TENANT_REHABINCO : undefined }
  );
  console.log(JSON.stringify(respuesta, null, 2));
  if (respuesta.status !== 200) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
