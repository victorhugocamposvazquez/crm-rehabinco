import * as cheerio from "cheerio";
import { parsearActualizadoIdealista } from "@/lib/captacion/brightdata/fecha-portal";

export type FichaIdealista = {
  externo_id: string;
  descripcion: string | null;
  banos: number | null;
  planta: string | null;
  fotos: string[];
  actualizado: string | null;
  contact_name: string | null;
  valida: boolean;
};

const FOTO = /https?:\/\/img\d\.idealista\.com\/[^\s"'<>]+/gi;

/** Una URL por id de imagen. Gana WEB_DETAIL-XL-L y se conserva /blur/. */
export function fotosDeGaleria(urls: string[]): string[] {
  const mejor = new Map<string, string>();
  for (const cruda of urls) {
    const url = cruda.replace(/&amp;/g, "&").split("?")[0];
    if (!/img\d\.idealista\.com/i.test(url) || !/\/blur\//i.test(url)) continue;
    const id = (url.match(/\/(\d{6,})\.(?:jpe?g|webp|png)$/i) || [])[1];
    if (!id) continue;
    const previa = mejor.get(id);
    if (!previa || rango(url) > rango(previa)) mejor.set(id, url);
  }
  return [...mejor.values()].map((url) => url.replace(/\/blur\/[^/]+\//i, "/blur/WEB_DETAIL-XL-L/"));
}

function rango(url: string): number {
  if (/WEB_DETAIL-XL-L/i.test(url)) return 3;
  if (/WEB_DETAIL/i.test(url)) return 2;
  return 1;
}

function sano(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

/** Lee la ficha. No busca teléfono ni contact-phones. */
export function parsearFichaIdealista(html: string, urlEntrada?: string | null): FichaIdealista | null {
  const externo_id = (urlEntrada?.match(/\/inmueble\/(\d+)/) || html.match(/\/inmueble\/(\d+)/) || [])[1];
  if (!externo_id) return null;
  if (/access denied|captcha|dd\.idealista\.com/i.test(html) && !/article|adComments|item-detail/i.test(html)) {
    return { externo_id, descripcion: null, banos: null, planta: null, fotos: [], actualizado: null, contact_name: null, valida: false };
  }
  const $ = cheerio.load(html);
  const urls: string[] = [];
  const crudo = $.html();
  for (const match of crudo.matchAll(FOTO)) urls.push(match[0]);
  const fotos = fotosDeGaleria(urls);
  const descripcion =
    sano($(".adCommentsLanguage").first().text()) ||
    sano($(".comment").first().text()) ||
    sano($("[class*='comment'] p").text()) ||
    null;
  let banos: number | null = null;
  let planta: string | null = null;
  const detalles = $(".details-property-feature-one, .details-property-feature-two, .info-features, .item-detail")
    .toArray()
    .map((el) => sano($(el).text()));
  const cuerpo = sano($("body").text());
  for (const t of [...detalles, cuerpo]) {
    const b = t.match(/(\d+)\s*bañ/i);
    if (b && banos == null) banos = Number(b[1]);
    if (!planta && /planta/i.test(t) && t.length < 80) planta = t;
  }
  const actualizadoTexto = (cuerpo.match(/Anuncio actualizado el\s+[^.]{3,40}/i) || [])[0];
  const actualizado = actualizadoTexto ? parsearActualizadoIdealista(actualizadoTexto) : null;
  const contact_name =
    sano($(".professional-name, .advertiser-name, .particular-name, .owner-name").first().text()) || null;
  const valida = Boolean(descripcion || fotos.length > 0);
  return { externo_id, descripcion, banos, planta, fotos, actualizado, contact_name, valida };
}
