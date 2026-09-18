import { normalizarTelefono } from "../../../../lib/captacion/pipeline/normalize.js";
import type { AnuncioCrudo, ListadoParseado, PortalAdapter, ZonaContratada } from "../types.js";
import {
  paginaListadoDesdeHtml,
  type HabitacliaItem,
} from "./extract-json.js";
import { parseDetailLegacyHtml } from "./parse-detail.js";

const BASE = "https://www.habitaclia.com";

export const PARSER_VERSION = "habitaclia-2026-09-17";

const TIPO_MAP: Record<string, string> = {
  flat: "piso",
  house: "casa",
  land: "terreno",
  premises: "local",
  garage: "garaje",
  office: "oficina",
  building: "edificio",
};

function slugOperacion(operacion: ZonaContratada["operacion"]): string {
  return operacion === "alquiler" ? "alquilar" : "comprar";
}

function tipoInmueble(item: HabitacliaItem): string {
  const base = TIPO_MAP[item.property?.propertyType ?? ""] ?? "otro";
  const sub = item.property?.propertySubtype ?? "";
  if (sub.includes("penthouse")) return "atico";
  if (sub.includes("duplex")) return "duplex";
  if (sub.includes("loft")) return "piso";
  if (sub.includes("terraced")) return "casa";
  if (sub.includes("rustic")) return "casa";
  return base;
}

export function contactoTipoPortal(item: HabitacliaItem): "particular" | "profesional" {
  const pub = item.summary?.publisher;
  if (!pub) return "particular";
  if (pub.isAgent) return "profesional";
  if (pub.legacyPublisherId) return "profesional";
  if (pub.navigationUrl?.includes("/inmobiliaria")) return "profesional";
  return "particular";
}

function itemAAnuncio(item: HabitacliaItem): AnuncioCrudo {
  const loc = item.summary?.location;
  const vis = loc?.visibility?.toUpperCase();
  const tipoContacto = contactoTipoPortal(item);
  const fotos = (item.summary?.multimedia?.images ?? [])
    .map((img) => img.url)
    .filter((u): u is string => Boolean(u));

  return {
    portal_id: "habitaclia",
    externo_id: item.legacyNumericId,
    url: item.navigationUrl?.startsWith("http")
      ? item.navigationUrl
      : `${BASE}${item.navigationUrl ?? `/i${item.legacyNumericId}.htm`}`,
    titulo: item.summary?.title,
    descripcion: item.summary?.description,
    operacion: item.transaction?.type === "rent" ? "alquiler" : "venta",
    tipo: tipoInmueble(item),
    precio: item.transaction?.price?.hidden ? undefined : item.transaction?.price?.amount,
    superficie: item.property?.builtSurface,
    habitaciones: item.property?.rooms,
    banos: item.property?.bathrooms,
    planta: item.property?.floor != null ? String(item.property.floor) : undefined,
    municipio: loc?.municipality,
    zona: loc?.district ?? loc?.displayZoneLine,
    direccion: loc?.displayAddressLine,
    lat: loc?.coordinates?.latitude,
    lng: loc?.coordinates?.longitude,
    geo_aproximada: vis != null && vis !== "EXACT",
    fotos,
    n_fotos: item.summary?.multimedia?.counts?.images ?? fotos.length,
    contacto_nombre: item.summary?.publisher?.name ?? undefined,
    contacto_telefono: normalizarTelefono(item.contact?.phone) ?? undefined,
    anunciante: tipoContacto === "profesional" ? "profesional" : "particular",
    nombre_comercial: item.summary?.publisher?.tradeName ?? undefined,
    publicado_en: item.summary?.updatedAt,
    contacto_tipo_portal: tipoContacto,
  } as AnuncioCrudo;
}

export const habitacliaAdapter: PortalAdapter = {
  id: "habitaclia",
  parserVersion: PARSER_VERSION,
  transport: "http",
  filtroParticularNativo: true,
  detalleNecesario: "nunca",
  ritmo: { minMs: 8000, maxMs: 15000, concurrencia: 1 },

  buildListUrl(zona, pagina) {
    const op = slugOperacion(zona.operacion);
    const provincia = String(zona.portal_params.provincia_slug ?? "").replace(/^\/+|\/+$/g, "");
    const municipio = String(zona.portal_params.municipio_slug ?? "").replace(/^\/+|\/+$/g, "");
    if (!provincia || !municipio) {
      throw new Error("portal_params.provincia_slug y municipio_slug son obligatorios");
    }
    const particulares = zona.portal_params.solo_particulares === false ? "" : "/particulares";
    const base = `${BASE}/${op}/viviendas/${provincia}/${municipio}${particulares}/s`;
    return pagina <= 1 ? base : `${base}/${pagina}`;
  },

  parseList({ body }) {
    const page = paginaListadoDesdeHtml(body);
    const items = page?.initialSearchResultsPage?.initialSearchContext?.results?.items ?? [];
    const pagination = page?.initialSearchResultsPage?.initialSearchContext?.results?.pagination;
    return {
      items: items.map(itemAAnuncio),
      hayMasPaginas: pagination ? pagination.page < pagination.totalPages : false,
    };
  },

  buildDetailUrl(item) {
    return item.url ?? `${BASE}/i${item.externo_id}.htm?from=list`;
  },

  parseDetail({ body }) {
    const page = paginaListadoDesdeHtml(body);
    const items = page?.initialSearchResultsPage?.initialSearchContext?.results?.items;
    if (items?.[0]) {
      const mapped = itemAAnuncio(items[0]);
      return {
        contacto_telefono: mapped.contacto_telefono,
        contacto_nombre: mapped.contacto_nombre,
        descripcion: mapped.descripcion,
        direccion: mapped.direccion,
        fotos: mapped.fotos,
        n_fotos: mapped.n_fotos,
        publicado_en: mapped.publicado_en,
      };
    }
    return parseDetailLegacyHtml(body);
  },

  detectarBloqueo({ status, body }) {
    if (status === 403 || status === 429) return true;
    const b = body.toLowerCase();
    if (b.includes("datadome") || b.includes("cf-challenge") || b.includes("attention required")) {
      return true;
    }
    // Fichas legacy incluyen reCAPTCHA de contacto; solo bloquear páginas cortas tipo challenge.
    return body.length < 8000 && b.includes("captcha");
  },
};

export function totalAnunciosEnJson(html: string): number {
  const page = paginaListadoDesdeHtml(html);
  return page?.initialSearchResultsPage?.initialSearchContext?.results?.pagination?.totalCount ?? 0;
}
