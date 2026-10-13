import type { SupabaseClient } from "@supabase/supabase-js";
import { rastrearMercado } from "./crawl/market-listings-crawl";
import { resolverSlugsPortal, slugsPortalPorMunicipio } from "./crawl/portal-slugs";
import type { PortalRastreo } from "./market/card";

const PORTALES: PortalRastreo[] = ["fotocasa", "habitaclia", "pisos"];
const MIN_POR_PORTAL = 12;

/**
 * Cualquier municipio INE entra en el rastreo la primera vez que se valora.
 * La pasada de esa petición baja una página de Fotocasa, Habitaclia y Pisos
 * (venta y alquiler) para poder devolver ofertas en la misma valoración.
 * Idealista no se rastrea: solo entra si ya está en captación.
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
