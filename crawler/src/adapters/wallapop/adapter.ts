import type { AnuncioCrudo, PortalAdapter, ZonaContratada } from "../types.js";
import {
  contactoTipoWallapop,
  fotosWallapop,
  itemsWallapopDesdeJson,
  operacionDesdeItem,
  type WallapopItem,
  urlItemWallapop,
} from "./extract-listado.js";

const API = "https://api.wallapop.com/api/v3/search";
const PAGE_SIZE = 40;

export const PARSER_VERSION = "wallapop-2026-09-17";

function deviceId(): string {
  return process.env.WALLAPOP_DEVICE_ID?.trim() || "crm-crawler-worker";
}

function itemAAnuncio(item: WallapopItem, operacionDefault: ZonaContratada["operacion"]): AnuncioCrudo {
  const tipoContacto = contactoTipoWallapop(item);
  const loc = item.location;
  return {
    portal_id: "wallapop",
    externo_id: item.id,
    url: urlItemWallapop(item),
    titulo: item.title,
    descripcion: item.description,
    operacion: operacionDesdeItem(item) ?? operacionDefault,
    tipo: "piso",
    precio: item.price?.amount,
    superficie: item.type_attributes?.surface,
    habitaciones: item.type_attributes?.rooms,
    banos: item.type_attributes?.bathrooms,
    municipio: loc?.city ?? loc?.region2,
    provincia: loc?.region2 ?? loc?.region,
    codigo_postal: loc?.postal_code,
    lat: loc?.latitude,
    lng: loc?.longitude,
    geo_aproximada: true,
    fotos: fotosWallapop(item),
    n_fotos: item.images?.length,
    anunciante: tipoContacto === "profesional" ? "profesional" : "desconocido",
    contacto_tipo_portal: tipoContacto,
    publicado_en: item.created_at ?? item.modified_at,
  } as AnuncioCrudo;
}

export const wallapopAdapter: PortalAdapter = {
  id: "wallapop",
  parserVersion: PARSER_VERSION,
  transport: "http",
  filtroParticularNativo: false,
  detalleNecesario: "nunca",
  ritmo: { minMs: 6000, maxMs: 12000, concurrencia: 1 },
  referer: "https://es.wallapop.com/",
  httpHeaders: {
    Host: "api.wallapop.com",
    "X-DeviceOS": "0",
    Origin: "https://es.wallapop.com",
    Accept: "application/json",
    "x-appversion": process.env.WALLAPOP_APP_VERSION?.trim() || "81234",
    "x-deviceid": deviceId(),
  },

  buildListUrl(zona, pagina) {
    const lat = Number(zona.portal_params.lat ?? 43.3623);
    const lng = Number(zona.portal_params.lng ?? -8.4115);
    const radio = Number(zona.portal_params.radio_km ?? 15);
    const categoryId = Number(zona.portal_params.category_id ?? 200);
    const keywords = String(zona.portal_params.keywords ?? "piso");
    const start = Math.max(0, (pagina - 1) * PAGE_SIZE);
    const params = new URLSearchParams({
      source: "search_box",
      keywords,
      category_id: String(categoryId),
      latitude: String(lat),
      longitude: String(lng),
      distance_in_km: String(radio),
      order_by: "most_relevance",
      start: String(start),
    });
    return `${API}?${params.toString()}`;
  },

  parseList({ body }) {
    const { items, hayMasPaginas } = itemsWallapopDesdeJson(body);
    return {
      items: items.map((i) => itemAAnuncio(i, "venta")),
      hayMasPaginas,
    };
  },

  detectarBloqueo({ status, body }) {
    if (status === 403 || status === 429) return true;
    return body.length < 200 && body.toLowerCase().includes("forbidden");
  },
};

export function totalAnunciosEnFixture(body: string): number {
  return itemsWallapopDesdeJson(body).items.length;
}
