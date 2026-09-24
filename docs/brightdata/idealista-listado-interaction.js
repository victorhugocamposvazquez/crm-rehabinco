// Collector de LISTADO. No abre fichas y no pide teléfono.
// Paginación: la página siguiente solo si hay «siguiente», tope de seguridad 60.
// El schedule del panel de Bright Data debe estar desactivado: el CRM dispara una vez al día, a las 04:30 UTC.

country('es');

let url;
if (input.listing_url) url = new URL(input.listing_url);
else if (input.url) url = new URL(input.url);
else url = new URL('https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/con-particulares/');

navigate(url.href, { allow_status: [403], timeout: 45000 });
close_popup('#didomi-notice', '#didomi-notice-agree-button');

if (status_code() === 403 || el_exists('#cmsg, iframe[src*="captcha-delivery"]', 2000)) {
  solve_captcha();
  wait_timeout(4000);
}

if (!el_exists('article.item', 20000)) {
  if (status_code() === 404 || status_code() === 410) dead_page('Listado no encontrado');
  blocked('Idealista ha bloqueado el listado');
}

const page = parse();
for (const item of page.items || []) collect(item);

const pagina = Number((url.href.match(/pagina-(\d+)/) || [])[1] || 1);
if (page.has_next_page && pagina < 60) {
  const base = url.href.replace(/\/pagina-\d+\.htm/, '').replace(/\/$/, '');
  rerun_stage({
    url: input.url,
    listing_url: `${base}/pagina-${pagina + 1}.htm`,
  });
}
