# Auditoría: captación Bright Data y consumo de CPU en Vercel

**Fecha:** 1 nov 2026  
**Alcance:** captación automática Idealista vía Bright Data Web Unlocker en el CRM Rehabinco  
**Contexto:** el equipo en Vercel fue suspendido por superar la cuota de Fluid Active CPU. En el periodo observado:

| Ruta | Invocaciones | Active CPU aprox. |
|------|--------------|-------------------|
| `/api/captacion/brightdata/procesar` | 118 | ~4 min |
| `/api/captacion/brightdata/trigger-novedades` | 40 | ~18 s |

**Objetivo:** mantener captación automática, fiable y actualizada, con el mínimo consumo de Fluid Active CPU en Vercel.

---

## Veredicto

La captación es **polling Unlocker + cola en Postgres**, no webhook. El coste Fluid relevante está casi solo en **`procesar`** (Cheerio + pipeline de guardado), no en Bright Data ni en los triggers.

**Recomendación original:** alivio corto en Vercel (early-exit / menos frecuencia) y valorar un worker Node aparte.

**Decisión de producto (nov 2026):** quedarse en **Vercel Pro + Supabase**. Las optimizaciones in-place (early-exit, incremental, batch, paralelo 3, métricas) están en `docs/OPTIMIZACION-CAPTACION-BRIGHTDATA-VERCEL.md`.

---

## 1. Qué inicia cada ejecución y con qué frecuencia

Los crons de captación viven en **Supabase `pg_cron` → `pg_net.http_post`**, no en `vercel.json` (ahí solo hay catastro, alertas y fichajes).

| Job pg_cron | Schedule | Endpoint Vercel |
|-------------|----------|-----------------|
| `captacion-idealista-listado` | `30 4 * * *` (04:30 UTC) | `POST /api/captacion/brightdata/trigger` |
| `captacion-idealista-novedades` | `*/15 * * * *` | `POST /api/captacion/brightdata/trigger-novedades` |
| `captacion-idealista-procesar` | `*/5 * * * *` | `POST /api/captacion/brightdata/procesar` |

Fuentes:

- `docs/CAPTACION-BRIGHTDATA.md`
- `supabase/migrations/20260924100000_captacion_extension_cron.sql`
- `supabase/migrations/20260925200000_captacion_rafagas_locks_cron.sql`
- `supabase/migrations/20261027123000_captacion_cron_novedades_15m.sql`

Autenticación: Bearer desde Vault (`captacion_cron_secret`). Timeout de `pg_net`: **15 s** (si Vercel tarda más, el cron puede marcar fallo aunque la Function siga con `waitUntil`).

No hay Supabase Edge Functions de captación (`supabase/functions/` vacío). No hay worker externo hoy.

---

## 2. Cómo se reciben y procesan los anuncios

```text
pg_cron
  ├─ trigger / trigger-novedades  → encola URLs en captacion_paginas_pendientes
  └─ procesar (cada 5 min)
       └─ waitUntil(ejecutarRafagaProcesar)
            ├─ lock captacion_locks (TTL 6 min)
            ├─ pedirUnlocker → Bright Data (HTML)
            ├─ Cheerio (parse listado / ficha)
            ├─ guardarAnuncioPipeline → captacion_anuncios (+ historial, dedup, score, AVM)
            └─ cierre de recogidas / retirados
```

### Trigger diario (`/trigger`)

1. Zonas activas (`captacion_brightdata_zonas`).
2. Abre `captacion_recogidas`.
3. Encola página 1 de cada zona + URL provincia-48h.

### Novedades (`/trigger-novedades`)

Solo el filtro provincia 48 h. Omite si ya hay páginas 48 h pendientes o un sondeo abierto. Barato en CPU (~18 s en el periodo).

### Procesar (`/procesar`)

Archivo: `app/api/captacion/brightdata/procesar/route.ts`

- Cron → **202** inmediato + `waitUntil(ejecutarRafagaProcesar())`.
- `maxDuration = 300`.
- Límites (`lib/captacion/brightdata/rafaga-config.ts`):
  - `RAFAGA_MAX_PAGINAS = 150`
  - `RAFAGA_PARALELO_UNLOCKER = 4`
  - `RAFAGA_TOPE_MS = 240_000` (4 min)
  - hasta 30 teléfonos con `sleep(2000)` entre ellos

**Modelo Bright Data:** Web Unlocker request/response (`POST https://api.brightdata.com/request`, `format: "raw"`). No Scraper Studio, no snapshot batch, no webhook.

---

## 3. Polling, reintentos, duplicidades, concurrencia

| Mecanismo | Implementación |
|-----------|----------------|
| Polling Unlocker | Una petición por URL de cola |
| Lock ráfaga | `captacion_locks`, clave `procesar`, TTL 6 min |
| Dedup páginas | upsert `(recogida_id, url)` con `ignoreDuplicates` |
| Bloqueo doble recogida | zonas con recogida abierta &lt; 6 h |
| Reintentos listado (transporte) | hasta 3 |
| Ficha / teléfono fallidos | `reintentar_en` (p. ej. +7 días) |
| Novedades idempotentes | omiten si ya hay cola 48 h |

**Riesgo menor:** `anotarLote` / `sumarVistos` hacen read-modify-write del JSON `externos` de la recogida sin transacción (bajo riesgo con el lock de ráfaga).

**Riesgo menor:** teléfonos pueden reintentar ciclos indefinidos cada 7 días (no hay techo absoluto de intentos a largo plazo).

---

## 4. ¿Se descargan y reprocesan anuncios que ya existen?

| Caso | Comportamiento |
|------|----------------|
| Listados | **Sí** se redescarga el HTML en cada pasada (necesario para precio, presencia y retirados). |
| Anuncios en DB | Upsert por `(portal_id, externo_id)`; no inserta duplicados. |
| Fichas ya enriquecidas | No se re-encolan de forma habitual. |
| Coste por ítem de listado | `guardarAnuncioPipeline`: SELECT + INSERT/UPDATE + historial + dedup + score + volcado AVM (~6–10 queries). `ingestarIdealistaBrightData` usa `paralelo` default **1** (serie). |

---

## 5. Qué consume CPU frente a qué solo espera

| Trabajo | Tipo | Impacto Fluid Active CPU |
|---------|------|--------------------------|
| `pedirUnlocker` (fetch Bright Data) | Red / wall-clock | Bajo en Active CPU; alto en duración de Function |
| `sleep(2000)` entre teléfonos | Espera artificial | Infla wall-clock |
| Cheerio sobre HTML de listado/ficha | **CPU real** | Principal sospechoso del cupo Fluid |
| Pipeline DB en serie | Red + algo de CPU | Alarga la Function y el trabajo síncrono |
| Triggers / novedades | Poco | Encaja con ~18 s CPU observados |

**Interpretación de las métricas:** ~4 min Active CPU / 118 invocaciones ≈ **~2 s de CPU real por call** de media. Eso encaja con parseo + trabajo síncrono, no con facturar los 240 s de espera de red.

La suspensión del equipo suele ser el **cupo agregado** (captación + catastro/AVM/otras Functions largas). Aun así, `procesar` cada 5 minutos (también con cola vacía) es el disparador más frecuente de este flujo.

---

## 6. ¿Puede ejecutarse fuera de Vercel?

Sí. La lógica ya está en `lib/captacion/brightdata/*` y solo necesita:

- Token Bright Data + zona Unlocker  
- Service role Supabase  
- Misma autenticación de cron (`CRON_SECRET`)  
- Runtime **Node.js** (Cheerio)

Candidatos naturales: Railway, Fly.io, un VPS barato, o un contenedor siempre encendido. Supabase Edge Functions **no** es el destino natural (Deno, Cheerio, límite ~150 s &lt; tope actual 240 s).

---

## 7. Webhooks, colas, incremental, lotes

| Idea | Viabilidad aquí |
|------|-----------------|
| Webhook Bright Data | **No aplica** al modelo Unlocker request/response actual. |
| Cola | **Ya existe:** `captacion_paginas_pendientes` + recogidas + ráfagas. |
| Incremental | Ya: novedades cada 15 min (48 h) + pasada completa diaria. |
| Lotes | Ya: ráfagas de hasta 150 páginas / 4 en paralelo. Mejora pendiente: paralelizar ingesta por anuncio y batch de `anotarLote`/`sumarVistos`. |

---

## 8. Comparativa de arquitecturas

| Opción | Baja Fluid CPU en Vercel | Esfuerzo | Encaje con este repo |
|--------|--------------------------|----------|----------------------|
| **A. Optimizar en Vercel** | Parcial | Bajo | Alivio rápido |
| **B. Supabase Edge Functions** | Alto | Alto (Deno, Cheerio, 150 s) | Mal ROI |
| **C. Worker Node independiente** | **Máximo** | Medio (reusa el TS actual) | **Mejor** |

### Opción A — Optimizar Vercel (mantener arquitectura)

- Early-exit si no hay páginas pendientes (antes de Cheerio/Unlocker).
- Bajar frecuencia de `procesar` a `*/10` o `*/15` fuera del pico post-04:30.
- Subir `paralelo` de `ingestarIdealistaBrightData` de 1 → 5.
- Batch de `anotarLote` / `sumarVistos` al final de ráfaga.

**Pros:** sin infra nueva.  
**Contras:** el trabajo pesado sigue contando en el cupo Fluid del equipo.

### Opción B — Supabase Edge Functions

**Pros:** cron ya en pg_cron; DB cerca.  
**Contras:** port a Deno, Cheerio vía npm en Deno, límite de duración inferior al tope actual de ráfaga. Esfuerzo alto para el beneficio.

### Opción C — Worker Node aparte (recomendada)

**Pros:** elimina `procesar` del cupo Fluid; reutiliza el código TypeScript; sin límite artificial de 300 s de Vercel; mismos locks y cola.  
**Contras:** un servicio más (deploy, healthcheck, secretos).

---

## Recomendación justificada

1. **Fase 0 (inmediata, sin cortar lo automático):** early-exit con cola vacía + reducir frecuencia de `procesar` cuando no hay backlog.  
2. **Fase 1 (estructural):** mover solo `ejecutarRafagaProcesar` a un **worker Node**. Dejar en Vercel `trigger`, `trigger-novedades`, UI y acciones manuales. Apuntar el cron `captacion-idealista-procesar` a la URL del worker.  
3. **Fase 2:** en el worker, paralelizar ingesta y batch de anotaciones de recogida.

Así se mantiene captación automática y al día, se recorta el mayor consumidor Fluid de este flujo, y se evita el port a Deno.

---

## Plan de migración sin interrupciones

1. Crear entrypoint HTTP/CLI del worker que llame a `ejecutarRafagaProcesar()`.
2. Configurar env: Bright Data, Supabase service role, `CRON_SECRET`.
3. Probar a mano; comparar `captacion_rafagas` y cola pendiente con producción.
4. (Opcional) Dual-run 24–48 h: cron sigue en Vercel; worker solo en prueba.
5. Cambiar la URL del job `captacion-idealista-procesar` al worker. **No tocar** `trigger` ni `trigger-novedades`.
6. Verificar en Vercel Analytics **0** invocaciones de `/api/captacion/brightdata/procesar` por cron.
7. Healthcheck: alerta si no hay ráfaga `ok` en N horas.
8. Aplicar optimizaciones de ingesta en el worker.

Rollback: devolver la URL del cron a Vercel `/api/captacion/brightdata/procesar`.

---

## Archivos clave

| Área | Ruta |
|------|------|
| Procesar API | `app/api/captacion/brightdata/procesar/route.ts` |
| Novedades API | `app/api/captacion/brightdata/trigger-novedades/route.ts` |
| Trigger API | `app/api/captacion/brightdata/trigger/route.ts` |
| Ráfaga | `lib/captacion/brightdata/rafagas.ts` |
| Límites | `lib/captacion/brightdata/rafaga-config.ts` |
| Páginas / cola | `lib/captacion/brightdata/paginas.ts` |
| Unlocker | `lib/captacion/brightdata/unlocker.ts` |
| Ingesta | `lib/captacion/brightdata/ingestar.ts` |
| Guardado | `lib/captacion/pipeline/guardar.ts` |
| Lock | `lib/captacion/brightdata/procesar-lock.ts` |
| Doc operativa | `docs/CAPTACION-BRIGHTDATA.md` |

---

## Fuera de alcance de esta auditoría

- Cambiar el proveedor Bright Data o pasar a Scraper Studio/webhooks (requeriría otro producto BD).
- Implementar el worker o los cambios de Fase 0 (este documento es solo diagnóstico y plan).
