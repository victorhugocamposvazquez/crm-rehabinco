// Bloque 2 — ficha /inmueble/ (Interaction code). Copia del usuario (23 sep 2026).
// Sin country('es'), sin DataDome, sin tag_response. Preview OK a veces; batch largo falla.
// Usar idealista-bloque2-interaction.recomendado.js en su lugar.

navigate(input.url);

close_popup('#didomi-notice', '#didomi-notice-agree-button');

const phoneButtonSelector = '.hidden-contact-phones_link';
if (el_exists(phoneButtonSelector)) {
  click(phoneButtonSelector);
  wait_timeout(3000);
}

collect(parse());
