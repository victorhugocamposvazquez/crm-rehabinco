# Captación Idealista — estado a 24 sep 2026

Idealista entra solo por el listado de Bright Data. El teléfono lo guarda la extensión de Chrome cuando un usuario lo revela en la ficha. No hay collector de ficha.

## Producción

| Qué | Valor |
|-----|--------|
| App | https://crm.rehabinco.es/ |
| Collector de listado | `BRIGHTDATA_IDEALISTA_DATASET_ID` = `c_mud4tozqvl4iiruh1` |
| Webhook | `https://crm.rehabinco.es/api/captacion/brightdata?token=<BRIGHTDATA_WEBHOOK_SECRET>` |
| Disparo | `POST /api/captacion/brightdata/trigger` con `Authorization: Bearer <CRON_SECRET>`, o un admin |
| Extensión | `POST /api/captacion/telefono` y `GET /api/captacion/existen` con el token del perfil |

El schedule del panel de Bright Data tiene que estar desactivado. `pg_cron` llama al trigger a las 07:00 y 15:00 hora de Madrid (en verano, 05:00 y 13:00 UTC).

## Qué guarda el listado

Un registro por anuncio, sin teléfono. Si Idealista no manda fecha, la ficha del CRM dice **Detectado el {visto_primera_vez}** (tooltip: fecha en que el CRM lo vio por primera vez). Un anuncio sin teléfono sigue visible: **teléfono: falta**, o **capturado por X el día Y** si la extensión lo guardó. El botón de la ficha es **Abrir en Idealista**.

La extensión está en `extension/`. Nivel 1: al revelar el teléfono en una ficha, lo envía al CRM. Nivel 2: en el listado marca los anuncios que ya existen y si tienen teléfono. Nivel 3 (cola asistida) pendiente, sin implementar.

## Zonas

Catálogo de la provincia en `lib/captacion/brightdata/zonas.ts`. A Coruña, Santiago y Ferrol van por distritos. El resto, por municipio. Solo las zonas que ya se usaban (sin esas tres ciudades enteras) entran marcadas; las nuevas salen desmarcadas. En Ajustes el estimado es editable. Si pasa de 1.500, la UI avisa de que hay que partir la zona.

## Retirados

`captacion_recogidas`. Se cierra cuando el dataset entero está listo. Si una zona acaba en página llena (múltiplo de 30) y aún había siguiente, `incompleta = true` y no se retira. La primera recogida completa tampoco retira. Hace falta una anterior completa de las mismas zonas.

## Pendiente de ejecutar

Migraciones en el SQL Editor, si no están aplicadas:

- `supabase/migrations/20260923230000_captacion_recogidas.sql`
- `supabase/migrations/20260924100000_captacion_extension_cron.sql`

Y los dos secretos de vault que indica esa segunda migración. `CRON_SECRET` en Vercel tiene que coincidir con `captacion_cron_secret`.
