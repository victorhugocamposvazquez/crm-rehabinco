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
const ID_FOTO = /id\.pro\.es\.image\.master\/([a-z0-9]{2}\/[a-z0-9]{2}\/[a-z0-9]{2}\/\d+)/i;

/** Una URL XL-L .jpg por id. WEB_DETAIL_TOP es de anuncios relacionados. */
export function fotosDeGaleria(urls: string[]): string[] {
  const vistos = new Set<string>();
  const fotos: string[] = [];
  for (const cruda of urls) {
    const url = cruda.replace(/&amp;/g, "&").split("?")[0];
    if (!/img\d\.idealista\.com/i.test(url) || !/\/blur\//i.test(url) || /WEB_DETAIL_TOP/i.test(url)) continue;
    const id = (url.match(ID_FOTO) || [])[1];
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    fotos.push(`https://img4.idealista.com/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/${id}.jpg`);
  }
  return fotos;
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
