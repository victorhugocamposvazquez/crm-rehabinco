# Operativa Bright Data — Idealista (solo listado)

El teléfono no se pide a Bright Data. Se captura con la extensión de Chrome (`extension/README.md`) cuando alguien lo revela en el navegador.

El schedule del panel de Bright Data debe quedar **desactivado**. El listado lo dispara el CRM a las 07:00 y 15:00 (Europe/Madrid) con `pg_cron`.

## Scraper de listado

1. Scraper Studio → un solo bloque. Sin bloque de ficha.
2. Interaction: `docs/brightdata/idealista-listado-interaction.js`
3. Parser: `docs/brightdata/idealista-listado-parser.js`
4. Update schema con `docs/brightdata/idealista-listado-schema.json` y **Save to production**.
5. Delivery: Webhook JSON, split 50, `https://crm.rehabinco.es/api/captacion/brightdata?token=<BRIGHTDATA_WEBHOOK_SECRET>`
6. Quita cualquier schedule del panel.

La paginación sigue mientras haya página siguiente, con tope de seguridad de 60. El filtro de particulares es `/con-particulares/` en la ruta.

## Checklist

Diez registros al azar del webhook: `price`, `size` y `seller_type` coinciden con la web, y la `url` abre el anuncio. Si la última página de una zona viene llena (múltiplo de 30) y aún había siguiente, el CRM marca la recogida incompleta y no retira anuncios.
