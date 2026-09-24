import * as cheerio from "cheerio";
import { coordsListadoIdealista } from "@/lib/captacion/brightdata/geo-idealista";

const BASE = "https://www.idealista.com";

export type ItemListado = {
  externo_id: string;
  url: string;
  title: string | null;
  price: number | null;
  size: number | null;
  rooms: number | null;
  bathrooms: null;
  floor_text: string | null;
  property_type: string | null;
  municipality: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  description_snippet: string | null;
  agency_name: string | null;
  seller_type: "professional" | "private";
  tags: string | null;
  photos: string[];
};

export type ListadoParseado = {
  items: ItemListado[];
  next_url: string | null;
  final_url: string | null;
  sin_resultados: boolean;
};

function num(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = texto.replace(/\./g, "").replace(/,/g, ".").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function sano(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function abs(href: string | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, BASE).href;
  } catch {
    return null;
  }
}

/** Un anuncio por `article.item[data-element-id]`. Los `article.adv` no entran. */
export function parsearListadoIdealista(html: string, urlEntrada?: string | null): ListadoParseado {
  const $ = cheerio.load(html);
  const final_url = $('link[rel="canonical"]').attr("href") || urlEntrada || null;
  const geoPorId = coordsListadoIdealista(html);
  const items: ItemListado[] = [];

  $("article.item[data-element-id]").each((_, el) => {
    const $el = $(el);
    const externo_id = $el.attr("data-element-id")?.trim() || null;
    if (!externo_id) return;
    const link = $el.find("a.item-link").first();
    const href = link.attr("href");
    const url = abs(href);
    const title = link.attr("title") || sano(link.text()) || null;
    const tramos = title ? title.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const municipality = tramos.length ? tramos[tramos.length - 1] : null;
    const neighborhood = tramos.length > 2 ? tramos[tramos.length - 2] : null;
    const tipo = title?.match(/^(Piso|Casa|Chalet|Ático|Dúplex|Estudio|Loft|Casa rústica|Casa de pueblo|Casa adosada|Casa o chalet|Finca rústica|Planta baja)/i);
    const price = num(sano($el.find(".item-price").not(".item-price-by-area").first().text()));
    let rooms: number | null = null;
    let size: number | null = null;
    let floor_text: string | null = null;
    $el.find(".item-detail-char .item-detail").each((__, d) => {
      const t = sano($(d).text());
      if (/hab\b|hab\./i.test(t)) rooms = num(t);
      else if (/m²|m2/i.test(t)) size = num(t);
      else if (t) floor_text = t;
    });
    const branding = $el.find(".logo-branding").first();
    const agency_name = branding.find("a[title]").first().attr("title") || branding.find("img[alt]").first().attr("alt") || null;
    const seller_type = $el.attr("data-is-professional-ad") === "true" ? "professional" : "private";
    const photos: string[] = [];
    const vistas = new Set<string>();
    $el.find("img").each((__, im) => {
      const src = $(im).attr("src") || $(im).attr("data-src") || $(im).attr("data-ondemand-img") || "";
      if (/img\d\.idealista\.com/i.test(src) && !vistas.has(src)) {
        vistas.add(src);
        photos.push(src);
      }
    });
    const geo = geoPorId.get(externo_id);
    items.push({
      externo_id,
      url: url ?? href ?? "",
      title,
      price,
      size,
      rooms,
      bathrooms: null,
      floor_text,
      property_type: tipo?.[1] ?? null,
      municipality,
      neighborhood,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      description_snippet: sano($el.find(".item-description p").first().text()) || null,
      agency_name,
      seller_type,
      tags: sano($el.find(".listing-tags").text()) || null,
      photos,
    });
  });

  const next_url = abs($(".pagination li.next a").first().attr("href"));
  const cuerpo = sano($("body").text());
  const sin_resultados = items.length === 0 && /no hay resultados|sin resultados|no hemos encontrado|no se han encontrado/i.test(cuerpo);
  return { items, next_url, final_url, sin_resultados };
}
