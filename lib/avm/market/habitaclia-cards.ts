import {
  ascensorDesdeTexto,
  exteriorDesdeTexto,
  pistaEstado,
  plantaDesdeTexto,
  slugZona,
  type MarketListingCard,
  type OperacionMercado,
} from "./card";
import type { PaginaTarjetas } from "./fotocasa-cards";

type Item = {
  legacyNumericId?: string;
  id?: string;
  navigationUrl?: string;
  summary?: {
    title?: string;
    location?: {
      visibility?: string;
      district?: string;
      displayZoneLine?: string;
      municipality?: string;
      coordinates?: { latitude?: number; longitude?: number };
    };
    publisher?: { isAgent?: boolean; legacyPublisherId?: string | null; navigationUrl?: string | null };
  };
  property?: {
    propertyType?: string;
    propertySubtype?: string;
    rooms?: number;
    bathrooms?: number;
    builtSurface?: number;
    floor?: number | string | null;
  };
  transaction?: { type?: string; price?: { amount?: number; hidden?: boolean } };
};

const MUNICIPIO = "15030";

export { urlListadoHabitaclia } from "./portal-urls";

function extraerJsonParse(html: string, varName: string): unknown | null {
  for (const marker of [`${varName} = JSON.parse(`, `${varName}=JSON.parse(`]) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    let i = idx + marker.length;
    while (i < html.length && html[i] !== '"') i += 1;
    if (html[i] !== '"') continue;
    i += 1;
    const chunks: string[] = [];
    for (; i < html.length; i += 1) {
      const c = html[i];
      if (c === "\\") {
        const n = html[++i];
        if (n === "n") chunks.push("\n");
        else if (n === "r") chunks.push("\r");
        else if (n === "t") chunks.push("\t");
        else if (n === '"') chunks.push('"');
        else if (n === "\\") chunks.push("\\");
        else if (n === "u") {
          chunks.push(String.fromCharCode(parseInt(html.slice(i + 1, i + 5), 16)));
          i += 4;
        } else chunks.push(n ?? "");
        continue;
      }
      if (c === '"') break;
      chunks.push(c);
    }
    try {
      return JSON.parse(chunks.join(""));
    } catch {
      /* siguiente marcador */
    }
  }
  return null;
}

function itemsDe(html: string): { items: Item[]; page: number; totalPages: number; pageSize: number } {
  for (const varName of ["window.__INITIAL_PROPS__", "window.__INITIAL_CONTEXT_VALUE__"]) {
    const raw = extraerJsonParse(html, varName);
    const page = raw as {
      initialSearchResultsPage?: {
        initialSearchContext?: {
          results?: { items?: Item[]; pagination?: { page: number; totalPages: number } };
        };
      };
    };
    const results = page?.initialSearchResultsPage?.initialSearchContext?.results;
    const items = results?.items ?? [];
    if (items.length) {
      return {
        items,
        page: results?.pagination?.page ?? 1,
        totalPages: results?.pagination?.totalPages ?? 1,
        pageSize: items.length,
      };
    }
  }
  return { items: [], page: 1, totalPages: 1, pageSize: 0 };
}


function clase(item: Item): { main: "apartment" | "house"; property: string } | null {
  const base = (item.property?.propertyType ?? "").toLowerCase();
  const sub = (item.property?.propertySubtype ?? "").toLowerCase();
  if (base === "house" || /chalet|terraced|rustic|casa/.test(sub)) return { main: "house", property: sub || base };
  if (base === "flat" || /penthouse|duplex|loft|apartment|studio/.test(sub) || base === "") {
    if (!base && !sub) return { main: "apartment", property: "flat" };
    if (base === "land" || base === "garage" || base === "office" || base === "premises") return null;
    return { main: "apartment", property: sub || base || "flat" };
  }
  return null;
}

export function parseListingCardsHabitaclia(html: string, operation: OperacionMercado): PaginaTarjetas {
  const { items, page, totalPages } = itemsDe(html);
  const cards: MarketListingCard[] = [];
  for (const item of items) {
    const tipo = clase(item);
    const amount = item.transaction?.price?.hidden ? undefined : item.transaction?.price?.amount;
    const id = item.legacyNumericId || item.id;
    if (!tipo || !id || amount == null || amount <= 0) continue;
    const loc = item.summary?.location;
    const zona = loc?.district ?? loc?.displayZoneLine ?? null;
    const lat = loc?.coordinates?.latitude ?? null;
    const lng = loc?.coordinates?.longitude ?? null;
    const precision = lat == null || lng == null ? null : "exact";
    const pub = item.summary?.publisher;
    const titulo = item.summary?.title ?? zona;
    const texto = `${titulo ?? ""} ${zona ?? ""}`;
    cards.push({
      portal: "habitaclia",
      portalId: String(id),
      url: item.navigationUrl
        ? item.navigationUrl.startsWith("http")
          ? item.navigationUrl
          : `https://www.habitaclia.com${item.navigationUrl}`
        : null,
      operation: item.transaction?.type === "rent" ? "rent" : operation,
      mainType: tipo.main,
      propertyType: tipo.property,
      title: titulo ?? null,
      price: amount,
      surface: item.property?.builtSurface ?? null,
      rooms: item.property?.rooms ?? null,
      bathrooms: item.property?.bathrooms ?? null,
      floor: typeof item.property?.floor === "number" ? item.property.floor : plantaDesdeTexto(String(item.property?.floor ?? "")),
      hasElevator: ascensorDesdeTexto(texto),
      isExterior: exteriorDesdeTexto(texto),
      hasGarage: /garaje|parking/i.test(texto) ? true : null,
      hasTerrace: /terraza|balcón|balcon/i.test(texto) ? true : null,
      conditionHint: pistaEstado(texto),
      isAgency: pub ? Boolean(pub.isAgent || pub.legacyPublisherId || pub.navigationUrl?.includes("/inmobiliaria")) : null,
      zoneSlug: slugZona(zona),
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lng === "number" ? lng : null,
      locationPrecision: precision,
      postcode: null,
      municipalityCode: MUNICIPIO,
    });
  }
  return { cards, hasMore: page < totalPages && items.length > 0, total: null, pageSize: items.length };
}
