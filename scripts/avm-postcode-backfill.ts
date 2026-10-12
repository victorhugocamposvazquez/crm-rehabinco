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

async function inverso(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = (await res.json()) as { postalCode?: string };
  return typeof json.postalCode === "string" && /^\d{5}$/.test(json.postalCode) ? json.postalCode : null;
}

async function main(): Promise<void> {
  cargarEnv();
  const { createAdminClient } = await import("../lib/supabase/admin");
  const db = createAdminClient();
  const filasListado: { lat: number | null; lng: number | null }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from("market_listings")
      .select("lat, lng")
      .eq("location_precision", "exact")
      .not("lat", "is", null)
      .range(desde, desde + 999);
    if (error) throw new Error(error.message);
    filasListado.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const puntos = new Map<string, { lat: number; lng: number }>();
  for (const row of filasListado) {
    const lat = Number(Number(row.lat).toFixed(5));
    const lng = Number(Number(row.lng).toFixed(5));
    puntos.set(`${lat},${lng}`, { lat, lng });
  }

  for (let desde = 0; ; desde += 1000) {
    const { data: ya, error: errorCache } = await db.from("postcode_reverse_cache").select("lat, lng").range(desde, desde + 999);
    if (errorCache) throw new Error(errorCache.message);
    for (const row of ya ?? []) puntos.delete(`${Number(row.lat)},${Number(row.lng)}`);
    if (!ya || ya.length < 1000) break;
  }

  const lista = [...puntos.values()];
  console.log(`puntos nuevos ${lista.length}`);
  const filas: { lat: number; lng: number; postcode: string }[] = [];
  let hechos = 0;
  let fallos = 0;
  let cursor = 0;
  async function trabajador(): Promise<void> {
    while (cursor < lista.length) {
      const punto = lista[cursor];
      cursor += 1;
      let cp: string | null = null;
      try {
        cp = await inverso(punto.lat, punto.lng);
      } catch {
        cp = null;
      }
      if (!cp) {
        try {
          cp = await inverso(punto.lat, punto.lng);
        } catch {
          cp = null;
        }
      }
      if (cp) filas.push({ ...punto, postcode: cp });
      else fallos += 1;
      hechos += 1;
      if (hechos % 200 === 0) console.log(`hechos ${hechos} con cp ${filas.length} sin cp ${fallos}`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, () => trabajador()));

  for (let i = 0; i < filas.length; i += 200) {
    const trozo = filas.slice(i, i + 200);
    const { error: up } = await db.from("postcode_reverse_cache").upsert(trozo);
    if (up) throw new Error(up.message);
  }
  const aplicado = await db.rpc("market_listings_apply_postcodes");
  if (aplicado.error) throw new Error(aplicado.error.message);
  const fresco = await db.rpc("market_zone_stats_refresh");
  if (fresco.error) throw new Error(fresco.error.message);
  console.log(JSON.stringify({ puntos: lista.length, conCp: filas.length, sinCp: fallos, anuncios: aplicado.data }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
