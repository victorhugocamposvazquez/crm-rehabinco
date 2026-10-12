import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { rastrearMercado, type FiltroRastreo } from "../lib/avm/crawl/market-listings-crawl";
import type { PortalRastreo } from "../lib/avm/market/card";

function cargarEnv() {
  for (const rel of [".env.local", "crawler/.env"]) {
    const file = path.join(process.cwd(), rel);
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

function filtroDe(args: string[]): FiltroRastreo {
  const portal = args.find((arg): arg is PortalRastreo => arg === "fotocasa" || arg === "habitaclia" || arg === "pisos");
  const operation = args.find((arg): arg is "sale" | "rent" => arg === "sale" || arg === "rent");
  const municipalityCode = args.find((arg) => /^\d{5}$/.test(arg));
  return { portal, operation, municipalityCode };
}

async function main() {
  cargarEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const informes = await rastrearMercado(db, filtroDe(process.argv.slice(2)), (linea) => console.log(linea));
  console.log(JSON.stringify(informes, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
