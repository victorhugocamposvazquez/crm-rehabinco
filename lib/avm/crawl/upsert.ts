import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarketListingCard } from "../market/card";

export type PrecioHistorico = { date: string; price: number };

export type PrevioTarjeta = {
  price: number;
  price_history: unknown;
  first_seen: string;
};

export function esPrecioHistorico(value: unknown): value is PrecioHistorico {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.date === "string" && typeof row.price === "number";
}

export function historialTrasPrecio(previo: PrevioTarjeta | undefined, precio: number, hoy: string): PrecioHistorico[] {
  const history = Array.isArray(previo?.price_history) ? previo.price_history.filter(esPrecioHistorico) : [];
  if (previo && previo.price !== precio) return [...history, { date: hoy, price: precio }];
  return history;
}

export function filaMercado(card: MarketListingCard, hoy: string, previo?: PrevioTarjeta) {
  return {
    portal: card.portal,
    portal_id: card.portalId,
    url: card.url,
    operation: card.operation,
    main_type: card.mainType,
    property_type: card.propertyType,
    title: card.title,
    price: card.price,
    surface: card.surface,
    rooms: card.rooms,
    bathrooms: card.bathrooms,
    floor: card.floor,
    has_elevator: card.hasElevator,
    has_garage: card.hasGarage,
    has_terrace: card.hasTerrace,
    is_exterior: card.isExterior,
    condition_hint: card.conditionHint,
    is_agency: card.isAgency,
    locality: card.municipalityCode === "15030" ? "A Coruña" : null,
    postcode: card.postcode,
    municipality_code: card.municipalityCode,
    zone_slug: card.zoneSlug,
    lat: card.lat,
    lng: card.lng,
    location_precision: card.locationPrecision,
    first_seen: previo?.first_seen ?? hoy,
    last_seen: hoy,
    active: true,
    price_history: historialTrasPrecio(previo, card.price, hoy),
  };
}

export async function guardarTarjetas(db: SupabaseClient, cards: MarketListingCard[], hoy: string): Promise<number> {
  if (!cards.length) return 0;
  let escritos = 0;
  for (let i = 0; i < cards.length; i += 100) {
    const lote = cards.slice(i, i + 100);
    const portal = lote[0].portal;
    const { data, error } = await db
      .from("market_listings")
      .select("portal_id, price, price_history, first_seen")
      .eq("portal", portal)
      .in(
        "portal_id",
        lote.map((c) => c.portalId)
      );
    if (error) throw new Error(error.message);
    const previos = new Map<string, PrevioTarjeta>(
      (data ?? []).map((row) => [
        String(row.portal_id),
        { price: Number(row.price), price_history: row.price_history, first_seen: String(row.first_seen) },
      ])
    );
    const rows = lote.map((card) => filaMercado(card, hoy, previos.get(card.portalId)));
    const up = await db.from("market_listings").upsert(rows, { onConflict: "portal,portal_id" });
    if (up.error) throw new Error(up.error.message);
    escritos += rows.length;
  }
  return escritos;
}

/** Anuncios del municipio que no se han visto en 21 días. */
export async function retirarNoVistos(db: SupabaseClient, portal: string, municipalityCode: string, hoy: string): Promise<void> {
  const limite = new Date(`${hoy}T00:00:00.000Z`);
  limite.setUTCDate(limite.getUTCDate() - 21);
  const dia = limite.toISOString().slice(0, 10);
  const { error } = await db
    .from("market_listings")
    .update({ active: false })
    .eq("portal", portal)
    .eq("municipality_code", municipalityCode)
    .eq("active", true)
    .lt("last_seen", dia);
  if (error) throw new Error(error.message);
}
