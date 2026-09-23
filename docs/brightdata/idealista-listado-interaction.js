// Collector de LISTADO. No abre fichas: no hay next_stage a /inmueble/.
// Browser worker. Pega esto en el único Interaction code y borra el bloque 2.
//
// Entrada: { "url": "https://www.idealista.com/venta-viviendas/<lugar>/con-particulares/" }
// El filtro de particulares es el segmento de ruta /con-particulares/ (no un query).
// 14 zonas (lib/captacion/brightdata/zonas.ts):
// https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/arteixo-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/culleredo-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/sada-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/bergondo-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/cambre-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/carral-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/abegondo-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/a-coruna/santiago/con-particulares/
// https://www.idealista.com/venta-viviendas/ferrol-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/naron-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/ribeira-a-coruna/con-particulares/
// https://www.idealista.com/venta-viviendas/boiro-a-coruna/con-particulares/

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

if (!input.is_rerun && page.has_next_page) {
  const base = url.href.replace(/\/pagina-\d+\.htm/, '').replace(/\/$/, '');
  const maxPages = Math.min(10, Number(input.max_pages) || 10);
  for (let pagina = 2; pagina <= maxPages; pagina += 1) {
    rerun_stage({
      url: input.url,
      listing_url: `${base}/pagina-${pagina}.htm`,
      max_pages: maxPages,
      is_rerun: true,
    });
  }
}
