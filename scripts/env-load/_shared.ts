import { createReadStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Bbox A Coruña ciudad (aprox.) para filtrar cargas locales. */
export const BBOX_ACORUNA = {
  minLat: 43.3,
  maxLat: 43.42,
  minLng: -8.52,
  maxLng: -8.28,
};

/** Península, Baleares, Canarias, Ceuta y Melilla (Geofabrik «spain»). */
export const BBOX_ESPANIA = {
  minLat: 27,
  maxLat: 44.5,
  minLng: -19,
  maxLng: 5,
};

export type EnvLoadRegion = "acoruna" | "spain";

let envLoadRegion: EnvLoadRegion = "spain";

export function getEnvLoadRegion(): EnvLoadRegion {
  return envLoadRegion;
}

export function setEnvLoadRegion(r: EnvLoadRegion): void {
  envLoadRegion = r;
}

/** `--region spain|acoruna` o `--acoruna` (legacy). Por defecto: España. */
export function parseRegionArg(argv: string[] = process.argv): EnvLoadRegion {
  const i = argv.indexOf("--region");
  if (i >= 0) {
    const v = (argv[i + 1] ?? "").toLowerCase();
    if (v === "acoruna" || v === "coruna" || v === "a-coruna") return "acoruna";
    if (v === "spain" || v === "espana" || v === "es") return "spain";
  }
  if (argv.includes("--acoruna")) return "acoruna";
  return "spain";
}

export function cargarEnv(): void {
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

export async function adminClient(): Promise<SupabaseClient> {
  cargarEnv();
  const { createAdminClient } = await import("../../lib/supabase/admin");
  return createAdminClient();
}

export function enBbox(lat: number, lng: number): boolean {
  const box = getEnvLoadRegion() === "acoruna" ? BBOX_ACORUNA : BBOX_ESPANIA;
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

export type LayerRow = {
  layer: string;
  category: string | null;
  name: string | null;
  sense: "positive" | "negative" | "both" | "info" | null;
  props: Record<string, unknown>;
  geom: string;
  source: string;
  loaded_at: string;
};

export async function borrarCapa(
  db: SupabaseClient,
  filtro: { source?: string; layer?: string | string[] }
): Promise<void> {
  let q = db.from("environment_layers").delete();
  if (filtro.source) q = q.eq("source", filtro.source);
  if (filtro.layer) {
    if (Array.isArray(filtro.layer)) q = q.in("layer", filtro.layer);
    else q = q.eq("layer", filtro.layer);
  }
  const { error } = await q.gt("id", 0);
  if (error) throw new Error(error.message);
}

export async function insertarLotes(db: SupabaseClient, filas: LayerRow[], lote = 200): Promise<number> {
  let n = 0;
  for (let i = 0; i < filas.length; i += lote) {
    const chunk = filas.slice(i, i + lote);
    const { data, error } = await db.rpc("env_insert_layers", { p_rows: chunk });
    if (error) throw new Error(`${error.message} (lote ${i / lote})`);
    n += Number(data ?? chunk.length);
  }
  return n;
}

export function puntoWkt(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function lineaWkt(coords: [number, number][]): string {
  const body = coords.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `SRID=4326;LINESTRING(${body})`;
}

export function poligonoWkt(ring: [number, number][]): string {
  const c = ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `SRID=4326;POLYGON((${c}))`;
}

export function dataDir(sub: string): string {
  const dir = path.join(root, "data", "env", sub);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function leerJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export async function leerNdjson<T>(
  file: string,
  onLine: (row: T) => void | Promise<void>,
): Promise<void> {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    await onLine(JSON.parse(t) as T);
  }
}
