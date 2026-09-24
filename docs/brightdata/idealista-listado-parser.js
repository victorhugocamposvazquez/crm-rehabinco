// Collector de LISTADO. Un objeto { items, has_next_page }.
// El Interaction code hace collect() de cada item: un registro por anuncio, sin ficha.

const extractNumber = (text) => {
  if (!text) return null;
  const match = String(text).replace(/\./g, '').replace(/,/g, '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

const municipio =
  $('.breadcrumb-navigation-current, .listing-title, h1').first().text_sane() || null;

const pagina = Number((input.url || input.listing_url || '').match(/pagina-(\d+)/)?.[1] || 1);
const scraped_at = new Date().toISOString();
const items = [];

$('article.item').each((i, el) => {
  const nodo = $(el);
  const href = nodo.find('a.item-link').first().attr('href') || '';
  if (!href) return;
  const url = new URL(href, 'https://www.idealista.com').href;
  const externo_id = (url.match(/\/inmueble\/(\d+)/) || [])[1] || null;
  if (!externo_id) return;

  const title = nodo.find('a.item-link').first().attr('title') || nodo.find('.item-link').first().text_sane();
  const price = extractNumber(nodo.find('.item-price').first().text_sane());
  const detalles = nodo.find('.item-detail').text_sane();
  const size = extractNumber((detalles.match(/([\d.]+)\s*m/) || [])[1]);
  const rooms = extractNumber((detalles.match(/(\d+)\s*hab/) || [])[1]);
  const bathrooms = extractNumber((detalles.match(/(\d+)\s*bañ/) || [])[1]);

  let property_type = null;
  const tipo = String(title || '').match(/^(Piso|Casa|Chalet|Ático|Dúplex|Estudio|Loft)/i);
  if (tipo) property_type = tipo[1];

  const neighborhood = nodo.find('.item-link').first().text_sane() || null;
  const latRaw = nodo.attr('data-latitude') || nodo.attr('data-lat');
  const lngRaw = nodo.attr('data-longitude') || nodo.attr('data-lng') || nodo.attr('data-lon');
  const latitude = latRaw ? Number(latRaw) : null;
  const longitude = lngRaw ? Number(lngRaw) : null;

  const photos = [];
  nodo.find('img').each((k, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src') || '';
    if (/idealista\.com/i.test(src) && !/video\.master/i.test(src)) photos.push(src.split(' ')[0]);
  });

  const description_snippet = (nodo.find('.ellipsis, .item-description').first().text_sane() || '').slice(0, 280) || null;
  const agency_name =
    nodo.find('.hightop-agent .name, .logo-branding img, .item-multimedia-agency').first().attr('alt') ||
    nodo.find('.hightop-agent .name, .item-toolbar-contact').first().text_sane() ||
    null;
  const agency = agency_name && !/particular/i.test(agency_name) ? agency_name : null;

  items.push({
    url,
    externo_id,
    title: title || null,
    price,
    size,
    rooms,
    bathrooms,
    property_type,
    municipality: municipio,
    neighborhood,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    photos,
    description_snippet,
    agency_name: agency,
    seller_type: agency ? 'professional' : 'particular',
    listing_position: (pagina - 1) * 30 + i + 1,
    listing_url: input.url || input.listing_url || null,
    page: pagina,
    scraped_at,
  });
});

const has_next_page = $('.pagination li.next a').length > 0 && pagina < 60;
const sin_listado = $('article.item').length === 0 && $('.items-container').length === 0;
const final_url = input.final_url || input.url || input.listing_url || null;
if (items.length === 0) {
  items.push({
    listing_url: input.url || input.listing_url || null,
    final_url,
    sin_listado,
    page: pagina,
    page_items: 0,
    has_next_page: false,
    scraped_at,
  });
}
for (const item of items) {
  item.page_items = items.length === 1 && item.page_items === 0 ? 0 : items.length;
  item.has_next_page = has_next_page;
  item.final_url = final_url;
  item.sin_listado = sin_listado;
}

return { items, has_next_page, sin_listado, final_url };
