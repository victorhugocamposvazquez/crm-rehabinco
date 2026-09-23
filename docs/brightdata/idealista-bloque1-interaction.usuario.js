// Bloque 1 — listado Idealista (Interaction code). Copia del usuario (23 sep 2026).
// PROBLEMA: si input.url es /inmueble/, espera .detail-official-zone-back-link y no llega al bloque 2.
// Usar idealista-bloque1-interaction.recomendado.js en su lugar.

let url;
let is_pdp = false;

if (input.url) {
  url = new URL(input.url);
  is_pdp = url.pathname.includes('/inmueble/');
} else {
  const location = input.location || 'a-coruna-a-coruna';
  url = new URL(`https://www.idealista.com/venta-viviendas/${location}/`);
}

if (is_pdp && !input.listing_url) {
  navigate(url.href);

  close_popup('#didomi-notice', '#didomi-notice-agree-button');

  const back_link_selector = '.detail-official-zone-back-link a';
  wait(back_link_selector);

  const { listing_url } = parse();

  url = new URL(listing_url, 'https://www.idealista.com');
  navigate(url.href);
} else if (input.listing_url) {
  url = new URL(input.listing_url);
  navigate(url.href);
} else {
  if (input.min_price) {
    url.searchParams.set('precio-desde', input.min_price);
  }
  if (input.max_price) {
    url.searchParams.set('precio-hasta', input.max_price);
  }

  navigate(url.href);
}

close_popup('#didomi-notice', '#didomi-notice-agree-button');

const item_selector = 'article.item';
wait(item_selector);

let { property_urls, has_next_page, next_page_url } = parse();

console.log(`Found ${property_urls.length} properties on this page`);

if (!input.is_rerun && has_next_page) {
  const base_url = url.href.replace(/\/pagina-\d+\.htm/, '');
  const max_pages = input.max_pages || 10;

  for (let page = 2; page <= max_pages; page++) {
    const next_url = new URL(base_url);
    const base_path = next_url.pathname.replace(/\/$/, '');
    next_url.pathname = `${base_path}/pagina-${page}.htm`;

    rerun_stage({
      location: input.location,
      property_type: input.property_type,
      min_price: input.min_price,
      max_price: input.max_price,
      max_pages: input.max_pages,
      listing_url: next_url.href,
      is_rerun: true,
    });
  }
}

for (let property_url of property_urls) {
  next_stage({ url: property_url });
}
