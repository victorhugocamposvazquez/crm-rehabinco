// Bloque 2 — ficha /inmueble/ (Parser code). Recomendado (teléfono, published_at, photos).
// Output schema Bright Data: phone, published_at, publication_text, photos (+ resto campos).

const extractNumber = (text) => {
  if (!text) return null;
  const match = text.replace(/\./g, '').replace(/,/g, '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

const digitosTelefono = (valor) => {
  const compacto = String(valor || '').replace(/[^\d]/g, '');
  if (/^34[6-9]\d{8}$/.test(compacto)) return compacto.slice(2);
  return /^[6-9]\d{8}$/.test(compacto) ? compacto : null;
};

const meses = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const fechaIso = (texto) => {
  if (!texto) return null;
  const ahora = new Date();
  const t = String(texto).toLowerCase();
  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  if (/\bhoy\b/.test(t) || /hace\s+(un|una|\d+)\s+horas?/.test(t)) return iso(ahora);
  if (/\bayer\b/.test(t) || /hace\s+(un|1)\s+d[ií]a\b/.test(t)) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 1);
    return iso(d);
  }
  const hace = t.match(/hace\s+(\d+)\s+d[ií]as/);
  if (hace) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - Number(hace[1]));
    return iso(d);
  }
  const encontrado = t.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)/
  );
  if (!encontrado || meses[encontrado[2]] == null) return null;
  const dia = Number(encontrado[1]);
  const mes = meses[encontrado[2]];
  let anio = ahora.getFullYear();
  if (new Date(anio, mes, dia).getTime() > ahora.getTime() + 86400000) anio -= 1;
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const url = new URL($('link[rel="canonical"]').attr('href') || input.url);
const title = $('.main-info__title-main').text_sane();
const price = extractNumber($('.info-data-price .txt-bold').text_sane());
const size = extractNumber($('.info-features span').eq(0).text_sane());
const rooms = extractNumber($('.info-features span').eq(1).text_sane());

let bathrooms = null;
$('.details-property_features ul li').each((i, el) => {
  const text = $(el).text_sane();
  if (text.includes('baño')) bathrooms = extractNumber(text);
});

let property_type = null;
if (title) {
  const typeMatch = title.match(/^(Piso|Casa|Chalet|Ático|Dúplex|Estudio|Loft)/i);
  if (typeMatch) property_type = typeMatch[1];
}

const municipality = $('#headerMap .header-map-list').eq(2).text_sane();
const neighborhood = $('.main-info__title-minor').text_sane();
const description = $('.comment .adCommentsLanguage p').text_sane();
const sellerTypeText = $('.professional-name .name').text_sane();
const seller_type = sellerTypeText && sellerTypeText.toLowerCase().includes('profesional') ? 'professional' : 'private';

const fechaTexto =
  [
    $('.stats-text').text_sane(),
    $('.date-update-text').text_sane(),
  ].find((t) => t && /(actualiz|public|hace|hoy|ayer|\d+\s+de\s+)/i.test(t)) || null;
const published_at = fechaIso(fechaTexto);

let ajax = parser.telefono_ajax || null;
if (typeof ajax === 'string') {
  try {
    ajax = ajax.trim().startsWith('{') ? JSON.parse(ajax) : null;
  } catch (e) {
    ajax = null;
  }
}
const listaPhones = ajax ? [ajax.phone1, ajax.phone2, ajax.phone3].filter(Boolean) : [];
let phone = null;
for (const item of listaPhones) {
  phone = digitosTelefono(typeof item === 'string' ? item : item.number || item.formatted);
  if (phone) break;
}
if (!phone) {
  const candidatos = [
    $('a[href^="tel:"]').first().attr('href'),
    $('.hidden-contact-phones_formatted-phone').text_sane(),
    $('.phone-number').text_sane(),
    $('.hidden-contact-phones_text').text_sane(),
  ];
  for (const candidato of candidatos) {
    phone = digitosTelefono(candidato);
    if (phone) break;
  }
}

const contact_name = $('.professional-name span').text_sane() || $('.advertiser-name').text_sane();

const porId = new Map();
const anadir = (raw) => {
  if (!raw || typeof raw !== 'string') return;
  const limpio = raw.trim().split(/\s+/)[0].replace(/&quot;?.*$/i, '').replace(/["')]+$/, '');
  if (!/https?:\/\/img\d\.idealista\.com\//i.test(limpio)) return;
  if (/video\.master/i.test(limpio)) return;
  const id = (limpio.match(/id\.pro\.es\.image\.master\/([a-z0-9/]+)\./i) || [])[1];
  const host = (limpio.match(/https?:\/\/(img\d\.idealista\.com)/i) || [])[1];
  if (!id || !host) return;
  const esDeEstaFicha = /WEB_DETAIL(?!_TOP)/i.test(limpio);
  const prev = porId.get(id) || { host, ficha: false };
  if (esDeEstaFicha) prev.ficha = true;
  prev.host = host;
  porId.set(id, prev);
};
$('img, source').each((i, el) => {
  anadir($(el).attr('src'));
  anadir($(el).attr('data-src'));
  anadir($(el).attr('data-original'));
  String($(el).attr('srcset') || '')
    .split(',')
    .forEach((parte) => anadir(parte.trim()));
});
const hallados = String($.html() || '').match(/https?:\/\/img\d\.idealista\.com\/[^"'\\\s>]+/g) || [];
hallados.forEach(anadir);

const elegidas = [...porId.entries()].filter(([, info]) => info.ficha);
const lista = elegidas.length ? elegidas : [...porId.entries()];
const photos = lista.map(
  ([id, info]) => `https://${info.host}/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/${id}.jpg`
);

return {
  url: url.href,
  title,
  price,
  size,
  rooms,
  bathrooms,
  property_type,
  municipality,
  neighborhood,
  description,
  seller_type,
  phone,
  contact_name,
  published_at,
  publication_text: fechaTexto,
  photos,
};
