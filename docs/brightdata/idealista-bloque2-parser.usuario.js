// Bloque 2 — ficha /inmueble/ (Parser code). Copia del usuario (23 sep 2026).
// Sin published_at, photos ni telefono_ajax. Usar idealista-bloque2-parser.recomendado.js.

const extractNumber = (text) => {
  if (!text) return null;
  const match = text.replace(/\./g, '').replace(/,/g, '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

const url = new URL($('link[rel="canonical"]').attr('href') || input.url);

const title = $('.main-info__title-main').text_sane();

const priceText = $('.info-data-price .txt-bold').text_sane();
const price = extractNumber(priceText);

const sizeText = $('.info-features span').eq(0).text_sane();
const size = extractNumber(sizeText);

const roomsText = $('.info-features span').eq(1).text_sane();
const rooms = extractNumber(roomsText);

let bathrooms = null;
$('.details-property_features ul li').each((i, el) => {
  const text = $(el).text_sane();
  if (text.includes('baño')) {
    bathrooms = extractNumber(text);
  }
});

let property_type = null;
if (title) {
  const typeMatch = title.match(/^(Piso|Casa|Chalet|Ático|Dúplex|Estudio|Loft)/i);
  if (typeMatch) {
    property_type = typeMatch[1];
  }
}

const municipality = $('#headerMap .header-map-list').eq(2).text_sane();
const neighborhood = $('.main-info__title-minor').text_sane();
const description = $('.comment .adCommentsLanguage p').text_sane();

const sellerTypeText = $('.professional-name .name').text_sane();
const seller_type = sellerTypeText && sellerTypeText.toLowerCase().includes('profesional') ? 'professional' : 'private';

const telHref = $('a[href^="tel:"]').first().attr('href') || '';
const desdeEnlace = telHref.replace(/^tel:/i, '').replace(/[^\d]/g, '');
let phone = null;
if (desdeEnlace.length >= 9) {
  phone = desdeEnlace;
} else {
  const visible = $('.hidden-contact-phones_text, .hidden-contact-phones_formatted-phone').text_sane() || '';
  const digitos = visible.replace(/[^\d]/g, '');
  if (digitos.length >= 9) phone = digitos;
}

const contact_name = $('.professional-name span').text_sane() || $('.advertiser-name').text_sane();

return {
  url,
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
};
