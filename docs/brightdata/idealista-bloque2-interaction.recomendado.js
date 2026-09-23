// Bloque 2 — ficha /inmueble/ (Interaction code). Recomendado tras preview 111341722 (23 sep 2026).
// Browser worker. No hacer click aparte en .see-phones-btn (mismo nodo que .hidden-contact-phones_link).

country('es');
tag_response('telefono_ajax', /contact-phones/, { allow_error: true });

navigate(input.url, { allow_status: [403], timeout: 45000 });

close_popup('#didomi-notice', '#didomi-notice-agree-button');

if (status_code() === 403 || el_exists('#cmsg, iframe[src*="captcha-delivery"]', 2000)) {
  console.log('Desafío de Idealista en la ficha. Intentando resolverlo.');
  solve_captcha();
  wait_timeout(4000);
}

if (!el_exists('.main-info__title-main', 15000)) {
  const estado = status_code();
  if (estado === 404 || estado === 410) dead_page('Anuncio retirado');
  blocked('Idealista ha bloqueado esta conexión');
}

if (el_exists('.hidden-contact-phones_link', 3000)) {
  click('.hidden-contact-phones_link');
  wait_timeout(5000);
}

let data = parse();

const sacarNumero = (texto) => {
  const t = String(texto || '');
  const m = t.match(/"number"\s*:\s*"(\+?[\d\s]+)"/) || t.match(/"formatted"\s*:\s*"([\d\s]+)"/);
  if (!m) return null;
  const compacto = m[1].replace(/[^\d]/g, '');
  if (/^34\d{9}$/.test(compacto)) return compacto.slice(2);
  return /^\d{9}$/.test(compacto) ? compacto : null;
};

if (!data.phone) {
  const id = (String(input.url).match(/\/inmueble\/(\d+)/) || [])[1];
  if (id) {
    const urlTelefono = `https://www.idealista.com/es/ajax/ads/${id}/contact-phones`;
    navigate(urlTelefono, { allow_status: [403], referer: input.url, timeout: 45000 });
    if (status_code() === 403 || el_exists('#cmsg, iframe[src*="captcha-delivery"]', 2000)) {
      console.log('Desafío de Idealista en el teléfono. Intentando resolverlo.');
      solve_captcha();
      wait_timeout(4000);
    }
    const cuerpo = String(html() || '');
    console.log('contact-phones: ' + cuerpo.replace(/\s+/g, ' ').slice(0, 300));
    const numero = sacarNumero(cuerpo);
    if (numero) data.phone = numero;
  }
}

collect(data);
