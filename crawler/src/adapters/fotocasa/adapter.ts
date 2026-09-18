import { normalizarTelefono } from "../../../../lib/captacion/pipeline/normalize.js";
import type { AnuncioCrudo, ListadoParseado, PortalAdapter, ZonaContratada } from "../types.js";
import { bloqueoDatadomeOChallenge } from "../shared/bloqueo.js";
import {
  anunciosFotocasa,
  featureVal,
  propsFotocasaDesdeHtml,
  type FotocasaItem,
} from "./extract-listado.js";

const BASE = "https://www.fotocasa.es";
export const PARSER_VERSION = "fotocasa-2026-09-17";

const TIPO_MAP: Record<string, string> = {
  Flat: "piso",
  House: "casa",
  Land: "terreno",
  Garage: "garaje",
  Office: "oficina",
  Premises: "local",
  Building: "edificio",
};

function slugOperacion(op: ZonaContratada["operacion"]): string {
  return op === "alquiler" ? "alquilar" : "comprar";
}

function tituloItem(item: FotocasaItem): string {
  const tipo = TIPO_MAP[item.buildingType ?? ""] ?? "piso";
  const loc = item.address?.district ?? item.location ?? item.address?.municipality ?? "zona";
  return `${tipo.charAt(0).toUpperCase()}${tipo.slice(1)} en ${loc}`;
}

function itemAAnuncio(item: FotocasaItem, filtroParticular: boolean): AnuncioCrudo {
  const path = item.detail?.["es-ES"] ?? item.detailWithParams?.["es-ES"];
  const url = path ? (path.startsWith("http") ? path : `${BASE}${path}`) : undefined;
  const esPro = item.clientType === "professional";
  const tipoContacto = filtroParticular ? "particular" : esPro ? "profesional" : "particular";
  const fotos = item.multimedia?.filter((m) => m.type === "image" && m.src).map((m) => m.src!);
  return {
    portal_id: "fotocasa",
    externo_id: String(item.id),
    url,
    titulo: tituloItem(item),
    descripcion: item.description,
    operacion: "venta",
    tipo: TIPO_MAP[item.buildingSubtype ?? item.buildingType ?? ""] ?? "piso",
    precio: item.rawPrice ?? undefined,
    superficie: featureVal(item, "surface"),
    habitaciones: featureVal(item, "rooms"),
    banos: featureVal(item, "bathrooms"),
    planta: featureVal(item, "floor") != null ? String(featureVal(item, "floor")) : undefined,
    municipio: item.address?.municipality,
    zona: item.address?.district ?? item.location,
    codigo_postal: item.address?.zipCode,
    lat: item.coordinates?.latitude,
    lng: item.coordinates?.longitude,
    fotos,
    n_fotos: fotos?.length,
    contacto_telefono: normalizarTelefono(item.phone) ?? undefined,
    contacto_nombre: item.clientAlias ?? undefined,
    nombre_comercial: esPro ? item.clientAlias ?? undefined : undefined,
    anunciante: tipoContacto === "profesional" ? "profesional" : "particular",
    contacto_tipo_portal: tipoContacto,
    publicado_en: item.date?.timestamp ? new Date(item.date.timestamp).toISOString() : undefined,
  } as AnuncioCrudo;
}

export const fotocasaAdapter: PortalAdapter = {
  id: "fotocasa",
  parserVersion: PARSER_VERSION,
  transport: "http",
  transportRespaldo: "unblocker",
  filtroParticularNativo: true,
  detalleNecesario: "nunca",
  ritmo: { minMs: 10000, maxMs: 15000, concurrencia: 1 },

  buildListUrl(zona, pagina) {
    const op = slugOperacion(zona.operacion);
    const provincia = String(zona.portal_params.provincia_slug ?? "").replace(/^\/+|\/+$/g, "");
    if (!provincia) throw new Error("portal_params.provincia_slug es obligatorio");
    const municipio = String(zona.portal_params.municipio_slug ?? "").replace(/^\/+|\/+$/g, "");
    const segmento = municipio ? `${provincia}/${municipio}` : provincia;
    const base = `${BASE}/es/${op}/viviendas/${segmento}/todas-las-zonas/l`;
    const path = pagina <= 1 ? base : `${base}/${pagina}`;
    const qs = zona.portal_params.solo_particulares === false ? "" : "?filter=particulares";
    return `${path}${qs}`;
  },

  parseList({ body }) {
    const props = propsFotocasaDesdeHtml(body);
    const items = props?.initialSearch?.result?.realEstates ?? [];
    const page = props?.searchContext?.pageNumber ?? 1;
    const total =
      props?.initialSearch?.result?.counters?.realEstates ??
      props?.counters?.realEstates ??
      items.length;
    const perPage = items.length || 30;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    return {
      items: items.map((i) => itemAAnuncio(i, true)),
      hayMasPaginas: page < totalPages,
    };
  },

  buildDetailUrl(item) {
    return item.url;
  },

  detectarBloqueo({ status, body }) {
    return bloqueoDatadomeOChallenge(status, body);
  },
};

export function totalAnunciosEnFixture(html: string): number {
  return anunciosFotocasa(html).length;
}
