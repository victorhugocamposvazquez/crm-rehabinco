# Operativa Bright Data — Idealista (dos scrapers)

El listado entra solo. La ficha (teléfono) solo si pulsas **Pedir teléfono** en el CRM. No hay worker propio ni Railway para Idealista.

Aplica en Supabase la migración `supabase/migrations/20260923230000_captacion_recogidas.sql`.

En Vercel (proyecto `crm-rehabinco`, Production):

- `BRIGHTDATA_IDEALISTA_DATASET_ID` = collector del **listado**
- `BRIGHTDATA_IDEALISTA_FICHA_COLLECTOR_ID` = collector de la **ficha**
- El webhook sigue siendo `https://crm.rehabinco.es/api/captacion/brightdata?token=<BRIGHTDATA_WEBHOOK_SECRET>`

## 1. Scraper de listado (nuevo)

1. Scraper Studio → crear scraper. Un solo bloque. Borra el bloque de ficha si el asistente lo crea.
2. Interaction code: pega `docs/brightdata/idealista-listado-interaction.js`
3. Parser code: pega `docs/brightdata/idealista-listado-parser.js`
4. **Update schema** con `docs/brightdata/idealista-listado-schema.json`
5. **Save to production**
6. Delivery preferences: Webhook, JSON, split **50** líneas, URL de arriba. Sin programación de ficha aquí.
7. Schedule: **2 veces al día**. Input: las 14 URLs del comentario al inicio del interaction (llevan `/con-particulares/`).

El filtro de particulares es el segmento de ruta `/con-particulares/`, no un parámetro. Ejemplo: `https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/`

## 2. Scraper de ficha (el bloque 2 actual, separado)

1. Otro scraper. Sin schedule.
2. Interaction: `docs/brightdata/idealista-ficha-interaction.js`
3. Parser: `docs/brightdata/idealista-ficha-parser.js`
4. Update schema con `phone`, `published_at`, `publication_text`, `photos` (texto/número/array según el IDE) y **Save to production**.
5. Delivery: el mismo webhook. Sin programación: solo lo dispara el CRM.
6. Copia el id `c_...` a `BRIGHTDATA_IDEALISTA_FICHA_COLLECTOR_ID`.

## 3. Checklist antes de dar una pasada por buena

Abre 10 registros al azar del webhook y compáralos con la web:

- `price` y `size` coinciden con la tarjeta del listado
- `seller_type` es `particular` si no hay nombre de agencia, y `professional` si lo hay
- `url` abre el anuncio
- no hace falta teléfono en esta pasada

Si esos 10 cuadran, la pasada del listado es válida. El teléfono se pide después, anuncio a anuncio, desde Captación.
