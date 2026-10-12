import {
  ascensorDesdeTexto,
  exteriorDesdeTexto,
  pistaEstado,
  slugZona,
  type MarketListingCard,
  type OperacionMercado,
} from "./card";

type Feature = { key?: string; value?: number };
type Item = {
  id?: number | string;
  rawPrice?: number;
  buildingType?: string;
  buildingSubtype?: string;
  clientType?: string;
  address?: { district?: string; neighborhood?: string; zipCode?: string; municipality?: string };
  location?: string;
  coordinates?: { latitude?: number; longitude?: number; accuracy?: number };
  features?: Feature[];
  detail?: Record<string, string>;
};

export type PaginaTarjetas = {
  cards: MarketListingCard[];
  hasMore: boolean;
  total: number | null;
  pageSize: number;
};

const MUNICIPIO = "15030";

function feature(item: Item, key: string): number | undefined {
  return item.features?.find((f) => f.key === key)?.value;
}

function presente(item: Item, key: string): boolean | null {
  return item.features?.some((f) => f.key === key) ? true : null;
}

function tipo(item: Item): { main: "apartment" | "house"; property: string } | null {
  const sub = item.buildingSubtype ?? "";
  const base = item.buildingType ?? "";
  if (/house|chalet/i.test(sub) || /house/i.test(base)) return { main: "house", property: sub || base };
  if (/flat|attic|duplex|apartment|studio|penthouse/i.test(base + sub) || base === "Flat") {
    return { main: "apartment", property: sub || base };
  }
  return null;
}

export function urlListadoFotocasa(operation: OperacionMercado, pagina: number): string {
  const op = operation === "rent" ? "alquiler" : "comprar";
  const base = `https://www.fotocasa.es/es/${op}/viviendas/a-coruna-capital/todas-las-zonas/l`;
  const path = pagina <= 1 ? base : `${base}/${pagina}`;
  return `${path}?sortType=price&sortOrderDesc=false`;
}

export function parseListingCardsFotocasa(html: string, operation: OperacionMercado): PaginaTarjetas {
  const m = html.match(/<script[^>]*id="__initial_props__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { cards: [], hasMore: false, total: null, pageSize: 0 };
  let data: { initialSearch?: { result?: { realEstates?: Item[]; counters?: { realEstates?: number } } } };
  try {
    data = JSON.parse(m[1]) as typeof data;
  } catch {
    return { cards: [], hasMore: false, total: null, pageSize: 0 };
  }
  const items = data.initialSearch?.result?.realEstates ?? [];
  const total = data.initialSearch?.result?.counters?.realEstates ?? null;
  const cards: MarketListingCard[] = [];
  for (const item of items) {
    const clase = tipo(item);
    const price = item.rawPrice;
    if (!clase || !item.id || price == null || !Number.isFinite(price) || price <= 0) continue;
    const zona = item.address?.neighborhood ?? item.address?.district ?? item.location ?? null;
    const lat = item.coordinates?.latitude ?? null;
    const lng = item.coordinates?.longitude ?? null;
    const precision = lat == null || lng == null ? null : "exact";
    const floor = feature(item, "floor");
    const tituloZona = zona ?? item.address?.municipality ?? null;
    cards.push({
      portal: "fotocasa",
      portalId: String(item.id),
      url: item.detail?.["es-ES"]
        ? item.detail["es-ES"].startsWith("http")
          ? item.detail["es-ES"]
          : `https://www.fotocasa.es${item.detail["es-ES"]}`
        : null,
      operation,
      mainType: clase.main,
      propertyType: clase.property,
      title: tituloZona,
      price,
      surface: feature(item, "surface") ?? null,
      rooms: feature(item, "rooms") ?? null,
      bathrooms: feature(item, "bathrooms") ?? null,
      floor: floor != null && floor >= 0 && floor <= 40 ? floor : null,
      hasElevator: presente(item, "elevator"),
      isExterior: exteriorDesdeTexto(zona),
      hasGarage: presente(item, "parking"),
      hasTerrace: presente(item, "terrace") ?? presente(item, "balcony"),
      conditionHint: pistaEstado(zona),
      isAgency: item.clientType == null ? null : item.clientType === "professional",
      zoneSlug: slugZona(zona),
      lat,
      lng,
      locationPrecision: precision,
      postcode: item.address?.zipCode ?? null,
      municipalityCode: MUNICIPIO,
    });
  }
  return { cards, hasMore: false, total, pageSize: items.length };
}

/** `vistos` es la suma de anuncios del HTML, no el número de página. */
export function fotocasaTieneMas(total: number | null, vistos: number, enPagina: number): boolean {
  if (enPagina === 0) return false;
  if (total == null) return enPagina >= 20;
  return vistos < total;
}
