// Idealista — LISTADO. Un registro por anuncio. No abre fichas.
// Input: { url: "https://www.idealista.com/venta-viviendas/oleiros/con-particulares/", page?: 1 }

country('es');

const MAX_PAGINAS = 60;
const pagina = Number(input.page || 1);
const urlZona = String(input.zona_url || input.url);

navigate(input.url, { allow_status: [403, 404], timeout: 60000 });
close_popup('#didomi-notice', '#didomi-notice-agree-button');

const hayDesafio = status_code() === 403 || el_exists('#cmsg, iframe[src*="captcha-delivery"]', 2000);
if (hayDesafio) {
  blocked('Idealista: desafío anti-bot en el listado');
}

// Espera a que aparezcan los anuncios, sin abortar si no los hay
el_exists('article.item', 15000);

const data = parse();
const scraped_at = new Date().toISOString();

if (!data.items.length) {
  // Página sin anuncios: la ingesta decide si es "sin resultados" o "página inválida"
  collect({
    zona_url: urlZona,
    page: pagina,
    final_url: data.final_url,
    sin_listado: !data.sin_resultados,
    items_en_pagina: 0,
    scraped_at
  });
} else {
  data.items.forEach((item, i) => {
    collect(Object.assign({}, item, {
      zona_url: urlZona,
      page: pagina,
      final_url: data.final_url,
      sin_listado: false,
      items_en_pagina: data.items.length,
      listing_position: (pagina - 1) * 30 + i + 1,
      scraped_at
    }));
  });

  if (data.next_url && pagina < MAX_PAGINAS) {
    rerun_stage({ url: data.next_url, zona_url: urlZona, page: pagina + 1 });
  }
}
