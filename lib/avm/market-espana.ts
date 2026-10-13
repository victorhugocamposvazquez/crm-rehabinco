import type { SupabaseClient } from "@supabase/supabase-js";
import { rastrearMercado } from "./crawl/market-listings-crawl";
import { resolverSlugsPortal, slugsPortalPorMunicipio } from "./crawl/portal-slugs";
import type { PortalRastreo } from "./market/card";

const PORTALES: PortalRastreo[] = ["fotocasa", "habitaclia", "pisos"];
const MIN_POR_PORTAL = 12;

export type PuntoMercado = {
  municipalityCode?: string | null;
  censusSection?: string | null;
  locality?: string | null;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** Municipio para el slug del portal: el paréntesis de CartoCiudad es el municipio, no la parroquia. */
export function nombreDesdeDireccion(locality?: string | null, formatted?: string | null): string | null {
  const paren = formatted?.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (paren && !/^\d+$/.test(paren)) return paren;
  const loc = locality?.trim();
  if (loc && !/^\d+$/.test(loc)) return loc;
  return null;
}

async function nombreDesdePunto(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  const json = (await res.json()) as { muni?: string; municipality?: string; address?: string };
  return nombreDesdeDireccion(json.muni ?? json.municipality ?? null, json.address ?? null);
}

/**
 * Se llama dentro de la valoración, antes de calcular el precio.
 * Si el municipio todavía no tiene anuncios, esa misma petición da de alta
 * el pueblo y baja una página de Fotocasa, Habitaclia y Pisos.
 * Idealista no se rastrea: solo entra si ya está en captación.
 */
export async function asegurarMercadoMunicipio(db: SupabaseClient, punto: PuntoMercado): Promise<string | null> {
  const code = (punto.municipalityCode ?? punto.censusSection ?? "").replace(/\D/g, "").slice(0, 5);
  if (code.length !== 5) return null;
  let nombre = nombreDesdeDireccion(punto.locality, punto.formattedAddress);
  if (!nombre && punto.lat != null && punto.lng != null) {
    nombre = await nombreDesdePunto(punto.lat, punto.lng).catch(() => null);
  }

  const { data: target, error: leer } = await db
    .from("market_crawl_targets")
    .select("municipality_code")
    .eq("municipality_code", code)
    .maybeSingle();
  if (leer) return "No se ha podido mirar si este municipio ya se rastrea.";

  if (!target) {
    const { error } = await db.from("market_crawl_targets").insert({
      municipality_code: code,
      name: (nombre?.trim() || code).slice(0, 120),
      portals: [...PORTALES],
      operations: ["sale", "rent"],
      active: true,
    });
    if (error && !/duplicate|unique/i.test(error.message)) return "No se ha podido dar de alta el municipio en el rastreo.";
  }

  const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pasadas, error: errorPasadas } = await db
    .from("market_crawl_runs")
    .select("portal, cards_seen, error")
    .eq("municipality_code", code)
    .gte("started_at", desde);
  if (errorPasadas) throw new Error(errorPasadas.message);
  const yaBajado = new Set(
    (pasadas ?? [])
      .filter((row) => !row.error && Number(row.cards_seen) >= MIN_POR_PORTAL)
      .map((row) => String(row.portal)),
  );
  const cuentas = await Promise.all(
    PORTALES.map(async (portal) => {
      const { count, error } = await db
        .from("market_listings")
        .select("id", { count: "exact", head: true })
        .eq("municipality_code", code)
        .eq("portal", portal)
        .eq("active", true)
        .not("lat", "is", null);
      if (error) throw new Error(error.message);
      return { portal, n: count ?? 0 };
    }),
  );
  const faltan = cuentas.filter((c) => c.n < MIN_POR_PORTAL && !yaBajado.has(c.portal)).map((c) => c.portal);
  if (faltan.length === 0) return null;

  const slugs = await slugsPortalPorMunicipio(db, code);
  if (faltan.some((portal) => !slugs.has(portal)) && nombre?.trim()) {
    await resolverSlugsPortal(db, code, nombre);
  }

  let hayAnuncios = cuentas.some((c) => c.n > 0);
  for (const portal of faltan) {
    const informes = await rastrearMercado(db, {
      municipalityCode: code,
      portal,
      maxPages: 1,
      pausaMs: 250,
      skipDerive: true,
    });
    if (informes.some((i) => i.cardsUpserted > 0)) hayAnuncios = true;
  }
  if (!hayAnuncios) return "No se han podido leer los anuncios de este municipio.";
  return null;
}
