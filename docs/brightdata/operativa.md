# Operativa Bright Data — Idealista (solo listado)

El teléfono no se pide a Bright Data. Se captura con la extensión de Chrome (`extension/README.md`) cuando alguien lo revela en el navegador.

El listado lo pide el CRM al Web Unlocker. A las 04:30 UTC se abre la recogida; cada 5 minutos se procesan hasta 20 páginas. Scraper Studio y el webhook no se usan.

La paginación sigue mientras haya página siguiente, con tope de 60. No hay filtro de particulares. La novedad del día es una sola URL de provincia a 48 h, fuera de retirados.

## Checklist

Diez registros al azar del webhook: `price`, `size` y `seller_type` coinciden con la web, y la `url` abre el anuncio. Si la última página de una zona viene llena (múltiplo de 30) y aún había siguiente, el CRM marca la recogida incompleta y no retira anuncios.
