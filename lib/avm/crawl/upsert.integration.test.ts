import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { MarketListingCard } from "../market/card";
import { guardarTarjetas, retirarNoVistos } from "./upsert";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PORTAL_ID = "avm-test-upsert";

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of [".env.local", "crawler/.env"]) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || out[m[1]]) continue;
      const value = m[2].replace(/^"|"$/g, "");
      if (value) out[m[1]] = value;
    }
  }
  if (!out.NEXT_PUBLIC_SUPABASE_URL && out.SUPABASE_URL) out.NEXT_PUBLIC_SUPABASE_URL = out.SUPABASE_URL;
  return out;
}

function tarjeta(price: number): MarketListingCard {
  return {
    portal: "fotocasa",
    portalId: PORTAL_ID,
    url: null,
    operation: "sale",
    mainType: "apartment",
    propertyType: "Flat",
    title: "Tarjeta de prueba",
    price,
    surface: 80,
    rooms: 2,
    bathrooms: 1,
    floor: 3,
    hasElevator: true,
    isExterior: null,
    hasGarage: null,
    hasTerrace: null,
    conditionHint: null,
    isAgency: true,
    zoneSlug: "ensanche",
    lat: 43.37,
    lng: -8.41,
    locationPrecision: "exact",
    postcode: "15004",
    municipalityCode: "15030",
  };
}

function esBaseLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

const varsDeArranque = env();
const baseLocal = esBaseLocal(varsDeArranque.NEXT_PUBLIC_SUPABASE_URL || varsDeArranque.SUPABASE_URL);

describe.skipIf(!baseLocal)("upsert de market_listings", () => {
  it("conserva la primera vez, anota el cambio de precio y desactiva lo no visto en 21 días", async () => {
    const vars = { ...env(), ...process.env };
    const url = vars.NEXT_PUBLIC_SUPABASE_URL;
    const key = vars.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Falta la conexión a Supabase del repo");
    const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await db.from("market_listings").delete().eq("portal", "fotocasa").eq("portal_id", PORTAL_ID);

    await guardarTarjetas(db, [tarjeta(200000)], "2026-09-01");
    await guardarTarjetas(db, [tarjeta(180000)], "2026-10-12");
    const { data, error } = await db
      .from("market_listings")
      .select("price, price_history, first_seen, last_seen, active")
      .eq("portal", "fotocasa")
      .eq("portal_id", PORTAL_ID)
      .single();
    if (error) throw new Error(error.message);
    expect(Number(data.price)).toBe(180000);
    expect(data.first_seen).toBe("2026-09-01");
    expect(data.last_seen).toBe("2026-10-12");
    expect(data.price_history).toEqual([{ date: "2026-10-12", price: 180000 }]);
    expect(data.active).toBe(true);

    const viejo = await db.from("market_listings").update({ last_seen: "2026-08-01" }).eq("portal", "fotocasa").eq("portal_id", PORTAL_ID);
    if (viejo.error) throw new Error(viejo.error.message);
    await retirarNoVistos(db, "fotocasa", "15030", "2026-10-12");
    const despues = await db.from("market_listings").select("active").eq("portal", "fotocasa").eq("portal_id", PORTAL_ID).single();
    if (despues.error) throw new Error(despues.error.message);
    expect(despues.data.active).toBe(false);

    await db.from("market_listings").delete().eq("portal", "fotocasa").eq("portal_id", PORTAL_ID);
  });
});
