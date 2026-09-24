// Idealista — LISTADO. Devuelve { items, next_url, final_url, sin_resultados }.
// El interaction hace collect() de cada item.

const num = (t) => {
  if (!t) return null;
  const m = String(t).replace(/\./g, '').replace(/,/g, '.').match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const BASE = 'https://www.idealista.com';
const abs = (href) => {
  try { return new URL(href, BASE).href; } catch (e) { return null; }
};

const final_url = $('link[rel="canonical"]').attr('href') || input.url || null;

const items = [];

$('article.item').each((i, el) => {
  const $el = $(el);
  const link = $el.find('a.item-link').first();
  const href = link.attr('href');
  if (!href) return;

  const url = abs(href);
  const externo_id =
    (url && (url.match(/\/inmueble\/(\d+)/) || [])[1]) ||
    $el.attr('data-adid') ||
    $el.attr('data-element-id') ||
    null;
  if (!externo_id) return;

  const title = link.attr('title') || link.text_sane() || null;

  // "Piso en Rúa X, Monte Alto, A Coruña" -> barrio y municipio son los dos últimos tramos
  const tramos = title ? title.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const municipality = tramos.length ? tramos[tramos.length - 1] : null;
  const neighborhood = tramos.length > 2 ? tramos[tramos.length - 2] : null;

  let property_type = null;
  const tipo = title && title.match(/^(Piso|Casa|Chalet|Ático|Dúplex|Estudio|Loft|Casa rústica|Casa de pueblo|Casa adosada|Casa o chalet|Finca rústica|Planta baja)/i);
  if (tipo) property_type = tipo[1];

  const price = num($el.find('.item-price').first().text_sane());

  let rooms = null;
  let size = null;
  let floor_text = null;
  $el.find('.item-detail-char .item-detail').each((j, d) => {
    const t = $(d).text_sane();
    if (/hab\b|hab\./i.test(t)) rooms = num(t);
    else if (/m²|m2/i.test(t)) size = num(t);
    else if (t) floor_text = t;
  });

  const description_snippet = $el.find('.item-description').first().text_sane() || null;

  const branding = $el.find('.logo-branding');
  const agency_name =
    branding.find('a').first().attr('title') ||
    branding.find('img').first().attr('alt') ||
    null;
  const seller_type = agency_name ? 'professional' : 'private';

  const vistas = new Set();
  const photos = [];
  $el.find('img').each((j, im) => {
    const src = $(im).attr('src') || $(im).attr('data-src') || $(im).attr('data-ondemand-img') || '';
    if (/img\d\.idealista\.com/i.test(src) && !vistas.has(src)) {
      vistas.add(src);
      photos.push(src);
    }
  });

  const tags = $el.find('.listing-tags').text_sane() || null;

  items.push({
    externo_id,
    url,
    title,
    price,
    size,
    rooms,
    bathrooms: null,
    floor_text,
    property_type,
    municipality,
    neighborhood,
    latitude: null,
    longitude: null,
    description_snippet,
    agency_name,
    seller_type,
    tags,
    photos
  });
});

const nextHref = $('.pagination li.next a').first().attr('href');
const next_url = nextHref ? abs(nextHref) : null;

const cuerpo = $('body').text_sane() || '';
const sin_resultados = items.length === 0 && /no hay resultados|sin resultados|no hemos encontrado|no se han encontrado/i.test(cuerpo);

return { items, next_url, final_url, sin_resultados };
