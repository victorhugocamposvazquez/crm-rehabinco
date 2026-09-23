// Bloque 1 — listado Idealista (Parser code). Copia del usuario (23 sep 2026).

// If we're on a PDP and need to extract the listing URL
if ($('.detail-official-zone-back-link a').length && !$('article.item').length) {
  const listing_link = $('.detail-official-zone-back-link a').first();
  const listing_url = listing_link.attr('href');

  return {
    listing_url: listing_url,
  };
}

// Extract all property links from the listing page
const property_links = $('article.item a.item-link');

const property_urls = property_links
  .toArray()
  .map((link) => {
    const href = $(link).attr('href');
    if (href) {
      return new URL(href, 'https://www.idealista.com').href;
    }
    return null;
  })
  .filter(Boolean);

// Check if there's a next page
const next_page_link = $('.pagination li.next a').first();
const has_next_page = next_page_link.length > 0;
const next_page_url = has_next_page ? next_page_link.attr('href') : null;

console.log(`Found ${property_urls.length} property URLs`);

return {
  property_urls: property_urls,
  has_next_page: has_next_page,
  next_page_url: next_page_url,
};
