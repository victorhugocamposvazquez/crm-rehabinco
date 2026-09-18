import type { AnuncioCrudo, ListadoParseado, PortalAdapter, ZonaContratada } from "../types.js";
import { listadoPisosDesdeHtml } from "./extract-listado.js";
import { parseDetailPisosHtml } from "./parse-detail.js";

const BASE = "https://www.pisos.com";
export const PARSER_VERSION = "pisos-2026-09-17";

function slugOperacion(op: ZonaContratada["operacion"]): string {
  return op === "alquiler" ? "alquiler" : "venta";
}

function itemAAnuncio(
  item: ReturnType<typeof listadoPisosDesdeHtml>["items"][0],
  operacion: ZonaContratada["operacion"]
): AnuncioCrudo {
  return {
    portal_id: "pisos.com",
    externo_id: item.id.replace(".", "_"),
    url: item.url,
    titulo: item.titulo,
    descripcion: item.descripcion,
    operacion,
    tipo: item.tipo ?? "piso",
    precio: item.precio,
    superficie: undefined,
    municipio: item.municipio,
    lat: item.lat,
    lng: item.lng,
    fotos: item.fotos,
    n_fotos: item.fotos?.length,
    anunciante: "particular",
    contacto_tipo_portal: "particular",
  } as AnuncioCrudo;
}

export const pisosAdapter: PortalAdapter = {
  id: "pisos.com",
  parserVersion: PARSER_VERSION,
  transport: "http",
  filtroParticularNativo: true,
  detalleNecesario: "sin_telefono",
  ritmo: { minMs: 8000, maxMs: 15000, concurrencia: 1 },

  buildListUrl(zona, pagina) {
    const op = slugOperacion(zona.operacion);
    const tipo = String(zona.portal_params.tipo_slug ?? "piso").replace(/^\/+|\/+$/g, "");
    const municipio = String(zona.portal_params.municipio_slug ?? "").replace(/^\/+|\/+$/g, "");
    if (!municipio) throw new Error("portal_params.municipio_slug es obligatorio");
    const particulares = zona.portal_params.solo_particulares === false ? "" : "/particulares";
    const base = `${BASE}/${op}/${tipo}-${municipio}${particulares}/`;
    return pagina <= 1 ? base : `${base}${pagina}/`;
  },

  parseList({ body, url }) {
    const operacion = url.includes("/alquiler/") ? "alquiler" : "venta";
    const { items, totalResultados } = listadoPisosDesdeHtml(body);
    const parsed = items.map((i) => itemAAnuncio(i, operacion));
    const perPage = parsed.length || 1;
    const totalPages = Math.ceil(totalResultados / perPage);
    return {
      items: parsed,
      hayMasPaginas: totalPages > 1 && parsed.length > 0,
    };
  },

  buildDetailUrl(item) {
    return item.url ?? `${BASE}/comprar/piso-${item.externo_id.replace("_", ".")}/`;
  },

  parseDetail({ body }) {
    return parseDetailPisosHtml(body);
  },

  detectarBloqueo({ status, body }) {
    if (status === 403 || status === 429) return true;
    return body.length < 5000 && body.toLowerCase().includes("captcha");
  },
};

export function totalAnunciosEnFixture(html: string): number {
  return listadoPisosDesdeHtml(html).items.length;
}
