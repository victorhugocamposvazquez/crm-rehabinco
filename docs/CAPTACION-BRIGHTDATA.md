# Captación Idealista — estado a 24 sep 2026

Idealista entra por el Web Unlocker, pedido desde el CRM. El teléfono lo guarda la extensión de Chrome. No hay Scraper Studio ni webhook.

## Producción

| Qué | Valor |
|-----|--------|
| App | https://crm.rehabinco.es/ |
| Unlocker | `UNLOCKER_ZONE` + `BRIGHTDATA_API_TOKEN` |
| Apertura | `POST /api/captacion/brightdata/trigger` a las 04:30 UTC, o un admin |
| Páginas | `POST /api/captacion/brightdata/procesar` cada 5 minutos |
| Extensión | `POST /api/captacion/telefono` y `GET /api/captacion/existen` con el token del perfil |

`pg_cron` abre la recogida a las 04:30 UTC y procesa la cola cada 5 minutos.

## Qué guarda el listado

Un registro por anuncio, sin teléfono. Si Idealista no manda fecha, la ficha del CRM dice **Detectado el {visto_primera_vez}** (tooltip: fecha en que el CRM lo vio por primera vez). Un anuncio sin teléfono sigue visible: **teléfono: falta**, o **capturado por X el día Y** si la extensión lo guardó. El botón de la ficha es **Abrir en Idealista**.

La extensión está en `extension/`. Nivel 1: al revelar el teléfono en una ficha, lo envía al CRM. Nivel 2: en el listado marca los anuncios que ya existen y si tienen teléfono. Nivel 3 (cola asistida) pendiente, sin implementar.

## Zonas

Catálogo de la provincia en `lib/captacion/brightdata/zonas.ts`. A Coruña, Santiago y Ferrol van por distritos. El resto, por municipio. Solo las zonas que ya se usaban (sin esas tres ciudades enteras) entran marcadas; las nuevas salen desmarcadas. En Ajustes el estimado es editable. Si pasa de 1.500, la UI avisa de que hay que partir la zona.

## Retirados

`captacion_recogidas` y `captacion_paginas_pendientes`. Se cierra cuando no quedan páginas pendientes. Si una zona llega a la página 60 y aún hay siguiente, `incompleta = true` y no se retira. La URL de provincia a 48 h no entra en retirados. La primera recogida completa tampoco retira.

## Pendiente de ejecutar

Migraciones en el SQL Editor, si no están aplicadas:

- `supabase/migrations/20260923230000_captacion_recogidas.sql`
- `supabase/migrations/20260924100000_captacion_extension_cron.sql`

Y los dos secretos de vault que indica esa segunda migración. `CRON_SECRET` en Vercel tiene que coincidir con `captacion_cron_secret`.
