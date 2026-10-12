import {
  pistaEstado,
  slugZona,
  type MarketListingCard,
  type OperacionMercado,
  type TipoPrincipal,
} from "./card";
import type { PaginaTarjetas } from "./fotocasa-cards";

const MUNICIPIO = "15030";

export function urlListadoPisos(operation: OperacionMercado, kind: "piso" | "casas", pagina: number): string {
  const op = operation === "rent" ? "alquiler" : "venta";
  const base = `https://www.pisos.com/${op}/${kind}-a_coruna_capital/asc/`;
  return pagina <= 1 ? base : `${base}${pagina}/`;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"');
}

function entero(texto: string | undefined): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

type Ficha = {
  price: number | null;
  surface: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  zone: string | null;
  agency: boolean | null;
};

function fichas(html: string): Map<string, Ficha> {
  const map = new Map<string, Ficha>();
  for (const part of html.split('data-id="').slice(1)) {
    const corte = part.indexOf('"');
    if (corte < 0) continue;
    const id = part.slice(0, corte);
    if (!/^\d+\.\d+$/.test(id) || map.has(id)) continue;
    const bloque = decodeHtml(part.slice(0, 12000));
    const chars = [...bloque.matchAll(/ad-preview__char[^>]*>([^<]+)/g)].map((m) => m[1].trim());
    const planta = chars.find((c) => /planta/i.test(c));
    const floor = planta ? (/bajo/i.test(planta) ? 0 : entero(planta.match(/\d+/)?.[0])) : null;
    const subtitle = bloque.match(/ad-preview__subtitle[^>]*>([^<]+)/)?.[1]?.trim() ?? "";
    map.set(id, {
      price: entero(bloque.match(/ad-preview__price[^>]*>\s*([\d.]+)/)?.[1]),
      surface: entero(chars.find((c) => /m²|m2/i.test(c))?.match(/\d+/)?.[0]),
      rooms: entero(chars.find((c) => /hab/i.test(c))?.match(/\d+/)?.[0]),
      bathrooms: entero(chars.find((c) => /baño/i.test(c))?.match(/\d+/)?.[0]),
      floor: floor != null && floor >= 0 && floor <= 40 ? floor : null,
      zone: subtitle.replace(/\s*\(.*$/, "").trim() || null,
      agency: /inmobiliaria|agencia/i.test(bloque) ? true : null,
    });
  }
  return map;
}

export function parseListingCardsPisos(html: string, operation: OperacionMercado, kind: "piso" | "casas"): PaginaTarjetas {
  const mainType: TipoPrincipal = kind === "casas" ? "house" : "apartment";
  const porId = fichas(html);
  const cards: MarketListingCard[] = [];
  let vistos = 0;
  for (const bloque of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let ld: {
      "@type"?: string;
      "@id"?: string;
      url?: string;
      name?: string;
      description?: string;
      address?: { postalCode?: string };
      geo?: { latitude?: string | number; longitude?: string | number };
    };
    try {
      ld = JSON.parse(bloque[1]) as typeof ld;
    } catch {
      continue;
    }
    const t = ld["@type"];
    if (t !== "SingleFamilyResidence" && t !== "Apartment" && t !== "House") continue;
    const id = ld["@id"];
    if (!id) continue;
    vistos += 1;
    const ficha = porId.get(id);
    const precio = ficha?.price ?? null;
    if (precio == null || precio <= 0) continue;
    const nombre = decodeHtml(ld.name ?? "");
    const urlPath = ld.url ?? "";
    const lat = ld.geo?.latitude == null ? null : Number(ld.geo.latitude);
    const lng = ld.geo?.longitude == null ? null : Number(ld.geo.longitude);
    const coords = Number.isFinite(lat) && Number.isFinite(lng);
    const casa = kind === "casas" || /\bcasa\b|chalet/i.test(nombre);
    cards.push({
      portal: "pisos",
      portalId: id.replace(/\./g, "_"),
      url: urlPath.startsWith("http") ? urlPath : urlPath ? `https://www.pisos.com${urlPath}` : null,
      operation,
      mainType: casa ? "house" : mainType,
      propertyType: kind,
      title: nombre || null,
      price: precio,
      surface: ficha?.surface ?? null,
      rooms: ficha?.rooms ?? null,
      bathrooms: ficha?.bathrooms ?? null,
      floor: ficha?.floor ?? null,
      hasElevator: /ascensor/i.test(nombre) ? true : null,
      isExterior: /\bexterior\b/i.test(nombre) ? true : /\binterior\b/i.test(nombre) ? false : null,
      hasGarage: /garaje/i.test(nombre) ? true : null,
      hasTerrace: /terraza|balcón|balcon/i.test(nombre) ? true : null,
      conditionHint: pistaEstado(nombre),
      isAgency: ficha?.agency ?? null,
      zoneSlug: slugZona(ficha?.zone),
      lat: coords ? lat : null,
      lng: coords ? lng : null,
      locationPrecision: coords ? "exact" : null,
      postcode: ld.address?.postalCode ?? urlPath.match(/(\d{5})/)?.[1] ?? null,
      municipalityCode: MUNICIPIO,
    });
  }
  const total = entero(html.match(/([\d.]+)\s+resultados/i)?.[1]);
  return { cards, hasMore: false, total, pageSize: vistos };
}

export function pisosTieneMas(total: number | null, vistos: number, enPagina: number): boolean {
  if (enPagina === 0) return false;
  if (total == null) return enPagina >= 15;
  return vistos < total;
}
