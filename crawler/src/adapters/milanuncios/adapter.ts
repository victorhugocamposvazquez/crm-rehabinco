import type { AnuncioCrudo, ListadoParseado, PortalAdapter, ZonaContratada } from "../types.js";
import { bloqueoDatadomeOChallenge } from "../shared/bloqueo.js";
import { caracteristicasDesdeAttributes, caracteristicasDesdeTags, mergeCaracteristicas } from "./caracteristicas.js";
import { anunciosMilanuncios, paginaMilanunciosDesdeHtml, type MilanunciosAd } from "./extract-listado.js";
import { parseDetailMilanunciosHtml } from "./parse-detail.js";

const BASE = "https://www.milanuncios.com";
export const PARSER_VERSION = "milanuncios-2026-09-17";

function slugCategoria(op: ZonaContratada["operacion"]): string {
  return op === "alquiler" ? "alquiler-de-pisos" : "venta-de-pisos";
}

function fotosAbsolutas(images?: string[]): string[] | undefined {
  if (!images?.length) return undefined;
  return images.map((u) => (u.startsWith("http") ? u : `https://${u}`));
}

function itemAAnuncio(item: MilanunciosAd, filtroParticular: boolean): AnuncioCrudo {
  const esPro = item.sellerType === "professional";
  const tipoContacto = filtroParticular ? "particular" : esPro ? "profesional" : "particular";
  const car = mergeCaracteristicas(
    caracteristicasDesdeTags(item.tags),
    caracteristicasDesdeAttributes(item.attributes)
  );
  const geo = item.location?.geolocation;
  return {
    portal_id: "milanuncios",
    externo_id: item.id,
    url: item.url?.startsWith("http") ? item.url : item.url ? `${BASE}${item.url}` : undefined,
    titulo: item.title,
    descripcion: item.description,
    operacion: "venta",
    tipo: "piso",
    precio: item.price?.cashPrice?.value,
    superficie: car.superficie,
    habitaciones: car.habitaciones,
    banos: car.banos,
    planta: car.planta,
    municipio: item.city?.name ?? item.location?.city?.name,
    zona: item.location?.district,
    provincia: item.province?.name ?? item.location?.province?.name,
    lat: geo?.latitude,
    lng: geo?.longitude,
    geo_aproximada: geo != null,
    fotos: fotosAbsolutas(item.images),
    n_fotos: item.images?.length,
    anunciante: tipoContacto === "profesional" ? "profesional" : "particular",
    contacto_tipo_portal: tipoContacto,
    publicado_en: item.publishDate ?? item.updateDate,
  } as AnuncioCrudo;
}

export const milanunciosAdapter: PortalAdapter = {
  id: "milanuncios",
  parserVersion: PARSER_VERSION,
  transport: "http",
  transportRespaldo: "unblocker",
  filtroParticularNativo: true,
  detalleNecesario: "sin_telefono",
  ritmo: { minMs: 10000, maxMs: 15000, concurrencia: 1 },

  buildListUrl(zona, pagina) {
    const cat = slugCategoria(zona.operacion);
    const municipio = String(zona.portal_params.municipio_slug ?? "").replace(/^\/+|\/+$/g, "");
    if (!municipio) throw new Error("portal_params.municipio_slug es obligatorio");
    const particulares = zona.portal_params.solo_particulares === false ? "" : "/particulares";
    const base = `${BASE}/${cat}-en-${municipio}${particulares}/`;
    return pagina <= 1 ? base : `${base}${pagina}/`;
  },

  parseList({ body }) {
    const page = paginaMilanunciosDesdeHtml(body);
    const ads = page?.adListPagination?.adList?.ads ?? [];
    const pag = page?.adListPagination?.pagination;
    return {
      items: ads.map((a) => itemAAnuncio(a, true)),
      hayMasPaginas: pag ? (pag.page ?? 1) < (pag.totalPages ?? 1) : false,
    };
  },

  buildDetailUrl(item) {
    return item.url ?? `${BASE}/venta-de-pisos/${item.externo_id}.htm`;
  },

  parseDetail({ body }) {
    return parseDetailMilanunciosHtml(body);
  },

  detectarBloqueo({ status, body }) {
    return bloqueoDatadomeOChallenge(status, body);
  },
};

export function totalAnunciosEnFixture(html: string): number {
  return anunciosMilanuncios(html).length;
}
