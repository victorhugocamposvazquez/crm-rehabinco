import type { SupabaseClient } from "@supabase/supabase-js";
import { rastrearMercado } from "./crawl/market-listings-crawl";
import { resolverSlugsPortal, slugsPortalPorMunicipio } from "./crawl/portal-slugs";

const MIN_ANUNCIOS = 12;

/**
 * Cualquier municipio INE entra en el rastreo la primera vez que se valora.
 * La pasada de esa petición es corta (Fotocasa, dos páginas) para poder
 * devolver ofertas en la misma valoración.
 */
export async function asegurarMercadoMunicipio(
  db: SupabaseClient,
  municipalityCode: string | null | undefined,
  nombre: string | null | undefined,
): Promise<string | null> {
  const code = (municipalityCode ?? "").replace(/\D/g, "");
  if (code.length !== 5) return null;

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
      portals: ["fotocasa", "habitaclia", "pisos"],
      operations: ["sale", "rent"],
      active: true,
    });
    if (error && !/duplicate|unique/i.test(error.message)) return "No se ha podido dar de alta el municipio en el rastreo.";
  }

  const { count } = await db
    .from("market_listings")
    .select("id", { count: "exact", head: true })
    .eq("municipality_code", code)
    .eq("active", true)
    .not("lat", "is", null);
  if ((count ?? 0) >= MIN_ANUNCIOS) return null;

  const slugs = await slugsPortalPorMunicipio(db, code);
  if (!slugs.has("fotocasa") && nombre?.trim()) {
    await resolverSlugsPortal(db, code, nombre);
  }

  const informes = await rastrearMercado(db, {
    municipalityCode: code,
    portal: "fotocasa",
    maxPages: 2,
    pausaMs: 250,
    skipDerive: true,
  });
  const fallo = informes.find((i) => i.error && i.cardsUpserted === 0)?.error ?? null;
  if (fallo && (count ?? 0) === 0) return "No se han podido leer los anuncios de este municipio.";
  return null;
}
