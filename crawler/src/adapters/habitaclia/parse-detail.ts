import { normalizarTelefono } from "../../../../lib/captacion/pipeline/normalize.js";

function decodificarJsString(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function limpiarHtml(texto: string): string {
  return texto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function campoDto(html: string, campo: string): string | null {
  const re = new RegExp(`${campo}:\\s*'((?:\\\\'|[^'])*)'`, "i");
  const m = html.match(re);
  return m?.[1] ? decodificarJsString(m[1]) : null;
}

function fechaDesdeTime(html: string): string | undefined {
  const m = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (!m?.[1]) return undefined;
  const partes = m[1].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!partes) return m[1];
  const [, d, mo, y] = partes;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000Z`;
}

function direccionDesdeHtml(html: string): string | undefined {
  const prefijo = prefijoImagen(html);
  if (prefijo) {
    const m = html.match(new RegExp(`imgh/${prefijo}/[^"]+"[^>]*alt="([^"]+)"`, "i"));
    if (m?.[1]) {
      const en = m[1].match(/\ben\s+(.+)$/i);
      return limpiarHtml(en?.[1] ?? m[1]);
    }
  }
  return undefined;
}

function prefijoImagen(html: string): string | null {
  const emp = html.match(/codigoEmpresa:\s*'?(\d+)'?/)?.[1];
  const prod = html.match(/codigoProducto:\s*'?(\d+)'?/)?.[1];
  if (emp && prod) return `${emp}-${prod}`;
  const dataId = html.match(/data-id="(\d+)"/)?.[1];
  if (dataId && dataId.length >= 10) return `${dataId.slice(0, 3)}-${dataId.slice(3, 10)}`;
  return null;
}

function fotosDesdeHtml(html: string): string[] {
  const urls = new Set<string>();
  const prefijo = prefijoImagen(html);
  const codigoAnuncio = html.match(/codigoAnuncio:\s*'?(\d+)'?/)?.[1];
  if (prefijo && codigoAnuncio) {
    for (const m of html.matchAll(
      new RegExp(`foto\\.htm\\?p=[^"'\\s]*${codigoAnuncio}[^"'\\s]*(?:&amp;|&)imagen=([^"'\\s&]+)`, "gi")
    )) {
      urls.add(`https://images.habimg.com/imgh/${prefijo}/${m[1]}`);
    }
    for (const m of html.matchAll(new RegExp(`images\\.habimg\\.com/imgh/${prefijo}/[^"'\\s]+`, "gi"))) {
      const href = m[0].startsWith("//") ? `https:${m[0]}` : m[0];
      urls.add(href.split("?")[0] ?? href);
    }
  }
  return [...urls];
}

function telefonoDesdeHtml(html: string): string | undefined {
  const bloque = html.match(/id="js-datos-finca-telefono"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (bloque) {
    const limpio = limpiarHtml(bloque);
    const e164 = normalizarTelefono(limpio);
    if (e164) return e164;
  }
  const dataPhone = html.match(/data-phone=["']([^"']+)["']/i)?.[1];
  if (dataPhone) {
    const e164 = normalizarTelefono(dataPhone);
    if (e164) return e164;
  }
  const telHref = html.match(/href=["']tel:([^"']+)["']/i)?.[1];
  if (telHref) {
    const e164 = normalizarTelefono(telHref);
    if (e164) return e164;
  }
  return undefined;
}

export function parseDetailLegacyHtml(body: string): {
  contacto_telefono?: string;
  contacto_nombre?: string;
  descripcion?: string;
  direccion?: string;
  fotos?: string[];
  n_fotos?: number;
  publicado_en?: string;
} {
  const ficha = body.includes("FichaDesktopDTO") ? body : "";
  const observaciones = ficha ? campoDto(ficha, "observaciones") : null;
  const destacado = ficha ? campoDto(ficha, "destacado") : null;
  const descripcion = observaciones
    ? limpiarHtml(observaciones)
    : destacado
      ? limpiarHtml(destacado)
      : undefined;

  const fotos = fotosDesdeHtml(body);
  const tel = telefonoDesdeHtml(body);

  return {
    ...(tel ? { contacto_telefono: tel } : {}),
    ...(descripcion ? { descripcion } : {}),
    ...(direccionDesdeHtml(body) ? { direccion: direccionDesdeHtml(body) } : {}),
    ...(fotos.length ? { fotos, n_fotos: fotos.length } : {}),
    ...(fechaDesdeTime(body) ? { publicado_en: fechaDesdeTime(body) } : {}),
  };
}
