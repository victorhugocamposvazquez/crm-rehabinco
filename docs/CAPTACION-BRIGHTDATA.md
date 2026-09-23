# Captación Idealista vía Bright Data — handoff técnico

Documento para continuar el trabajo (otro modelo, otro dev). Estado del repo **`victorhugocamposvazquez/crm-rehabinco`**, rama **`main`**, a **23 sep 2026**.

---

## 1. Qué es el sistema

El CRM Rehabinco tiene un módulo **Captación** (`/captacion`): anuncios de portales inmobiliarios, fases (novedad → contacto → visita → negociando → captado/descartado), agrupación por contacto (teléfono), alertas y notificaciones.

**Idealista** no usa la API oficial de partners en producción. El flujo acordado es:

1. **Bright Data Scraper Studio** — collector publicado que abre listados y fichas de Idealista.
2. **Entrega al CRM** — webhook JSON en lotes + descarga manual vía API (`GET /dca/dataset`).
3. **CRM** — mapea JSON → `captacion_anuncios` (Supabase), upsert idempotente por `(portal_id, externo_id)`.

Hay **otro camino** en el repo (crawler Docker + `crawl_jobs` para Habitaclia, etc.). **No confundir** con Idealista/Bright Data. El sync antiguo devuelve **410** (`app/api/captacion/sync/route.ts`).

---

## 2. Producción (importante)

| Qué | Valor |
|-----|--------|
| App real | https://crm.rehabinco.es/ |
| Preview Vercel del repo | https://crm-rehabinco.vercel.app/ |
| Proyecto Vercel correcto | **`crm-rehabinco`** (NO `crm-dev`, NO confiar solo en `crm-rehabinco-two`) |
| Repo GitHub | `victorhugocamposvazquez/crm-rehabinco` |

Variables en **Production** del proyecto Vercel real (no pegar tokens en chat):

- `BRIGHTDATA_API_TOKEN`
- `BRIGHTDATA_IDEALISTA_DATASET_ID` → collector **`c_mud4tozqvl4iiruh1`**
- `BRIGHTDATA_WEBHOOK_SECRET` → mismo valor que el query `token=` del webhook
- Opcional: `BRIGHTDATA_IDEALISTA_URL`, `BRIGHTDATA_WEBHOOK_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (ingesta webhook/import)

Webhook configurado en Bright Data **Delivery preferences**:

```text
https://crm.rehabinco.es/api/captacion/brightdata?token=<BRIGHTDATA_WEBHOOK_SECRET>
```

Formato **JSON**, **split delivery** ~**20 líneas** por POST.

---

## 3. Arquitectura de datos

### 3.1 Tabla principal

`captacion_anuncios` (ver migraciones `20260914140027`, `20260915140000`, `20260917120000`):

- Clave lógica: `portal_id = 'idealista'` + `externo_id` (id numérico Idealista, ej. `111341722`)
- Contacto: `contacto_telefono`, `contacto_nombre`, `contacto_clave` (`tel:+34…` o `nom:nombre|municipio`)
- Fecha portal: `publicado_en` (timestamptz). Si al insertar no hay fecha Idealista, se usa **hora de ingestión** → la UI la trata como “Sin fecha del portal” (`publicadoEsCarga`)
- Raw: columna `raw` (jsonb) con el registro Bright Data
- Retirados: `desaparecido_en` — **existe en código** (`desaparecidosTrasSync` en `lib/captacion/pipeline/upsert.ts`) pero **no está cableado** al cerrar una pasada Bright Data completa (ver §8)

### 3.2 Zonas Idealista

Catálogo fijo en código: `lib/captacion/brightdata/zonas.ts` — **14 municipios/zonas** (~4.500 anuncios estimados).

Persistencia opcional: tabla `captacion_brightdata_zonas` (migración `20260923100000_captacion_zonas_idealista.sql`). API superadmin: `GET/PUT /api/captacion/brightdata/zonas`.

Si la tabla no existe o falla, se usan **todas** las zonas del catálogo.

---

## 4. Flujo Bright Data ↔ CRM

```text
                    POST /dca/trigger?collector=c_mud4tozqvl4iiruh1&queue_next=1&override_incompatible_schema=1
Usuario/admin  -->  app/api/captacion/brightdata/trigger  -->  Bright Data
                    body: [{ "url": "https://www.idealista.com/venta-viviendas/..." }, ...]

Bright Data (webhook cada ~20 filas)  -->  POST /api/captacion/brightdata?token=...
                                           ingestarIdealistaBrightData()

Admin (import manual)  -->  POST /api/captacion/brightdata/importar  { id: "j_...", desde: 0 }
                            descargarSnapshot() + lotes de 80 registros

Admin (reparar raw guardado)  -->  POST /api/captacion/brightdata/aplicar  { desde: 0 }
                                   aplicarDatosPortalGuardados() — lee `raw` en BD
```

### 4.1 Disparo (`lib/captacion/brightdata/disparar.ts`)

- Collector `c_*` → `POST https://api.brightdata.com/dca/trigger` con query:
  - `collector`, `queue_next=1`, **`override_incompatible_schema=1`** (422 si `telefono_ajax` es objeto y el schema dice Text)
- **Sin** `notify` ni `deliver` en el trigger → usa **Delivery preferences** del collector (webhook).
- Respuesta: `collection_id` / `snapshot_id` → id **`j_...`**

### 4.2 Descarga (`descargarSnapshot`)

- `GET https://api.brightdata.com/dca/dataset?id=j_...`
- **202** + `{ status: "building" }` → aún no listo (poll; el CRM reintenta en import con espera)
- **200** → array JSON o **JSONL concatenado** → `parsearRespuestaDataset` / `leerCuerpoBrightData` (gzip soportado en webhook)
- **404** → collection inexistente, expirada (16 días) o id incorrecto

### 4.3 Webhook (`app/api/captacion/brightdata/route.ts`)

- Auth: `?token=`, header `Authorization: Bearer`, o `x-webhook-secret`
- Body: no usar `request.json()` a ciegas; **`leerCuerpoBrightData`** (JSONL / gzip)
- Si el payload solo trae `snapshot_id` sin filas → intenta descargar dataset
- Errores de ingest → **500** (Bright Data puede no reenviar ese lote)

### 4.4 Import manual (`app/api/captacion/brightdata/importar/route.ts`)

- Admin session
- Lotes de **80** registros, paralelo **8**, `maxDuration` **60** (Hobby Vercel)
- Cliente antiguo hacía loop hasta 200 lotes

### 4.5 Completar fichas (`app/api/captacion/brightdata/completar/route.ts`)

- Selecciona anuncios Idealista en fases abiertas que están **vacíos** (`anuncioIdealistaVacio`) **o** sin `contacto_telefono`
- Dispara **solo URLs** `/inmueble/{id}/` al collector
- **Gasta créditos** por ficha abierta

### 4.6 Aplicar desde raw (`app/api/captacion/brightdata/aplicar/route.ts`)

- Recorre filas Idealista en BD y extrae teléfono/fecha del **`raw`** guardado
- Útil solo si el **`raw` ya contenía** `phone` / `published_at` — no inventa datos

---

## 5. Mapeo CRM (`lib/captacion/brightdata/idealista.ts`)

- **`PARSER_VERSION`**: `brightdata-idealista-2026-09-22`
- **`mapearBrightDataIdealista(raw)`** → `AnuncioEntrante | null`
  - Devuelve **`null`** si no hay título **y** precio **y** fotos → no crea “Anuncio 12345” vacío ni pisa filas buenas
- **Teléfono** (`telefonoDe`): orden `telefono_ajax` (JSON), `contact_phones`, campos `phone`, etc.
  - `telefono_ajax` si es **string HTML** (DataDome/captcha) → **ignorado** (evita falsos como `963836808`)
  - Normalización: `libphonenumber` ES → E.164
- **Fecha** (`fechaDe` / `fechaPortalIdealista`): `published_at`, `publication_text`, textos “hace N días”, “22 de septiembre”, etc.
- **Fotos**: dedup por id imagen Idealista; preferir `WEB_DETAIL-XL-L`; **mantener `/blur/`** en URL (sin blur → 404)
- **`datosPortalDe(raw)`**: extrae solo `externoId`, teléfono y fecha aunque la ficha sea “vacía” para parches en ingest/aplicar

### 5.1 Upsert (`lib/captacion/pipeline/upsert.ts`)

- Teléfono: `entrante ?? previo` (nunca borrar teléfono bueno si una pasada viene null)
- `publicado_en` en **update** solo si entrante trae fecha **y** (no había fecha **o** la anterior era stamp de carga `publicadoEsCarga`)
- Insert nuevo sin fecha portal → `publicado_en = now()` (UI muestra “Sin fecha del portal”)

---

## 6. Bright Data — collector (Scraper Studio)

Collector ID: **`c_mud4tozqvl4iiruh1`**, template **v3 (prod)**.

En Bright Data hay **dos bloques** (cada uno con **Interaction code** + **Parser code**), ambos con **browser worker**.

### 6.1 Código en este repo (copiar/pegar en la IDE)

| Archivo | Qué es |
|---------|--------|
| `docs/brightdata/idealista-bloque1-interaction.usuario.js` | Interaction listado — **copia del usuario** (23 sep). Falla con URLs `/inmueble/` sueltas. |
| `docs/brightdata/idealista-bloque1-parser.usuario.js` | Parser listado — usuario (saca `property_urls`, paginación). |
| `docs/brightdata/idealista-bloque1-interaction.recomendado.js` | Interaction listado — **usar este**: `next_stage` si ya es ficha. |
| `docs/brightdata/idealista-bloque2-interaction.usuario.js` | Interaction ficha — usuario (solo navigate + clic teléfono). |
| `docs/brightdata/idealista-bloque2-parser.usuario.js` | Parser ficha — usuario (sin `photos` ni `published_at`). |
| `docs/brightdata/idealista-bloque2-interaction.recomendado.js` | Interaction ficha — DataDome, `tag_response`, fallback contact-phones. |
| `docs/brightdata/idealista-bloque2-parser.recomendado.js` | Parser ficha — teléfono, fecha, fotos `/blur/WEB_DETAIL-XL-L/`. |

**Qué pegar en producción (objetivo):**

1. Bloque 1 Interaction → `idealista-bloque1-interaction.recomendado.js`
2. Bloque 1 Parser → `idealista-bloque1-parser.usuario.js` (no cambió en las iteraciones)
3. Bloque 2 Interaction → `idealista-bloque2-interaction.recomendado.js`
4. Bloque 2 Parser → `idealista-bloque2-parser.recomendado.js`

Luego **Update schema** (campos `published_at`, `publication_text`, `photos`) y **Save to production**.

### 6.2 Output schema (campos que el CRM entiende)

| Campo Bright Data | CRM / notas |
|-------------------|-------------|
| `url` | Obligatorio para id `externo_id` |
| `title`, `price`, `size`, `rooms`, `bathrooms`, `property_type` | Ficha |
| `municipality`, `neighborhood`, `description`, `seller_type` | Ficha |
| **`phone`** | Display name puede ser “teléfono”; clave JSON **`phone`** |
| `contact_name` | Nombre anunciante |
| **`published_at`** | ISO `YYYY-MM-DD` — fecha portal |
| **`publication_text`** | Texto crudo Idealista (“Anuncio actualizado el…”) |
| **`photos`** | Array de URLs (con `/blur/`) |
| `telefono_ajax` | Inyectado por `tag_response`; objeto JSON en preview; schema a veces Text → usar `override_incompatible_schema=1` en trigger |

El CRM ignora HTML en `telefono_ajax` y lee `phone` + JSON válido (`lib/captacion/brightdata/idealista.ts`).

### 6.3 Comportamiento por bloque (resumen)

**Bloque 1 — listado**

- Entrada: `{ "url": "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/" }` (14 zonas vía trigger CRM)
- Paginación hasta 10 páginas → `rerun_stage` + `next_stage({ url: ficha })`
- **Crítico**: URL `/inmueble/` suelta → **`next_stage({ url })`**, no `wait('.detail-official-zone-back-link')`

**Bloque 2 — ficha**

- `country('es')`, cookies Didomi, clic `.hidden-contact-phones_link`, `collect(parse())` o `collect(data)`
- Preview OK: `https://www.idealista.com/inmueble/111341722/` → phone **881350992**, `published_at` **2026-09-22**, ~38 photos
- Batch largo: muchas filas DataDome → título vacío, phone null (problema operativo sep 2026)

### 6.4 Restricciones de producto (no romper)

- No OAuth Idealista legacy para captación masiva
- No borrar `lib/captacion/portales/legacy/idealista.ts` hasta que Bright Data escriba anuncios de verdad
- No marcar desaparecidos en snapshot parcial
- No formulario “Contactar” de Idealista para sacar teléfono
- Fotos del HTML ya cargado; **sin** clic en galería por foto extra
- Hobby Vercel: cron Catastro `0 8 * * *` (no `*/5`)

---

## 7. UI Captación (`components/captacion/portales/CaptacionPortales.tsx`)

Estado **actual (commit ~0ff098f)**:

- **Quitados** botones “Traer Idealista”, “Cargar recogida”, “Completar fichas”, “Actualizar Idealista” (evitar más gasto / palos de ciego)
- **Banner amarillo** si hay Idealista abiertos sin teléfono o sin fecha portal real: cuenta `sinTelefonoPortal`, `sinFechaPortal`
- Fichas Idealista **vacías** en novedad se **ocultan** de la lista (siguen en BD) — `anuncioIdealistaVacio`
- Detalle: galería fotos, “Solo por el portal”, “Sin fecha del portal”, timeline contacto colapsado, quitar de seguimiento, etc.

Rutas API **siguen existiendo**; un admin puede llamarlas con `fetch` o reactivar botones.

---

## 8. Problemas conocidos (sep 2026)

### 8.1 Calidad de la última pasada masiva

Recogidas API (usuario, 23 sep):

| collection_id | Notas |
|---------------|--------|
| `j_mue9q856184ug8pzl8` | ~17:39, 874 inputs, ~870 records |
| `j_muehl9ow292hnw4zof` | ~21:19, repetición |
| `j_muehvde1vt1lwdnpp` | ~21:27, repetición |

Síntomas en CRM:

- Muchos anuncios **sin teléfono** y **ninguna fecha de publicación** útil (`publicado_en` = hora de carga)
- Muchas fichas llegaron **vacías** (DataDome 403 tras crawls largos) → mapper `null`, o shells antiguos
- Import dijo “160 actualizados” pero **sin** teléfonos/fechas nuevos → el **archivo** no traía esos campos en la mayoría de filas
- Webhook falló hasta fix JSONL (`leerCuerpoBrightData`, commits ~47b0064 / 7066e2e) — **lotes ya enviados no se reenvían**

### 8.2 Causas técnicas

- **DataDome** en fichas y en XHR `/contact-phones` (403, HTML captcha)
- **Ad-blocking** Bright Data sustituye URLs con `/ads/`
- **`wait()`** en interaction abortaba `collect()` → schema vacío
- **`override_incompatible_schema=1`** puede omitir campos incompatibles (ej. `telefono_ajax`)
- Pasadas **repetidas** mismas zonas → **triple coste**, mismo resultado
- **`desaparecido_en`** no se actualiza al terminar una pasada Bright Data → anuncios retirados en Idealista **siguen visibles**

### 8.3 Lo que NO es fiable hoy

Tratar la lista como “mercado actual”. Es un **archivo parcial** hasta una pasada **completa** con:

1. Teléfono estable en producción (preview 1 ficha OK ≠ batch 800+)
2. `published_at` en schema y en filas
3. Listado completo por zona + lógica de retirados solo tras sync cerrado

---

## 9. Optimización de costes (para cuando haya créditos)

1. **Una sola** pasada programada; bloquear doble trigger mientras `j_*` activo
2. **No** re-disparar 14 zonas si solo faltan teléfonos → `completar` solo URLs sin teléfono **después** de validar preview batch
3. Dedup URLs antes de trigger; no repetir ids ya completos en CRM
4. Mantener webhook + lotes 20 (no notify-only — fulfillment 0/0)
5. Subir `maxDuration` o worker externo si ingest >60s para miles de filas
6. Validar **10 fichas aleatorias** del JSON descargado (phone + published_at) antes de considerar éxito

---

## 10. Mapa de archivos clave

| Ruta | Rol |
|------|-----|
| `lib/captacion/brightdata/disparar.ts` | trigger + descarga dataset + gzip/JSONL |
| `lib/captacion/brightdata/idealista.ts` | mapeo, parse JSONL, fechas, teléfono |
| `lib/captacion/brightdata/ingestar.ts` | upsert Supabase, aplicar raw |
| `lib/captacion/brightdata/config.ts` | env vars |
| `lib/captacion/brightdata/zonas.ts` | 14 zonas |
| `lib/captacion/pipeline/upsert.ts` | reglas merge teléfono/fecha |
| `app/api/captacion/brightdata/route.ts` | webhook |
| `app/api/captacion/brightdata/trigger/route.ts` | lanzar zonas activas |
| `app/api/captacion/brightdata/importar/route.ts` | bajar `j_*` |
| `app/api/captacion/brightdata/completar/route.ts` | re-scrape fichas pendientes |
| `app/api/captacion/brightdata/aplicar/route.ts` | tel/fecha desde raw en BD |
| `components/captacion/portales/CaptacionPortales.tsx` | UI |
| `lib/captacion/portales/legacy/idealista.ts` | API OAuth antigua — **no usar** para este flujo |

Tests: `lib/captacion/brightdata/idealista.test.ts`, `lib/captacion/pipeline/upsert.test.ts` — `npx tsx --test lib/captacion/brightdata/idealista.test.ts`

---

## 11. Pendientes de producto (backlog)

- Cablear **`desaparecidosTrasSync`** al cerrar una recogida Bright Data **completa**
- Alertas: conectar `/captacion` alertas con worker/crawler real
- Notificaciones retirados
- Dedup/score en upsert crawler
- Cita al pasar a visita
- Migración `captacion_brightdata_zonas` aplicada en Supabase prod
- Pasada Bright Data **sólida**: checklist preview → schema → una trigger → verificar JSON → UI sin banner

---

## 12. Deploy

Tras cambios que use el usuario en producción:

```bash
git push origin main
```

Comprobar deployment en proyecto Vercel **crm-rehabinco**. No dejar fixes solo en local.

Commits git locales: git 2.21 en máquina del usuario a veces requiere `git commit -F file` (sin `--trailer`).

---

## 13. Mensaje para el siguiente agente

El usuario necesita **captación Idealista creíble para sus jefes**: teléfonos, fechas reales, lista no obsoleta, coste controlado. El CRM **ya ingesta** bien cuando el JSON trae datos; el cuello de botella es **Bright Data + Idealista anti-bot** y **operativa** (no repetir jobs, no UI que prometa “actualizado”). Prioridad: **una pasada verificable** (muestra + batch pequeño + batch completo) antes de más UI o más triggers.

No pedir al usuario que pegue `BRIGHTDATA_API_TOKEN` en chat. No relanzar jobs cancelados conocidos (`j_mudw48hdle77970gz` fotos). No usar `crm-rehabinco-two` como referencia de env vars completas.

---

## 14. Historial rápido del scraper (para no repetir errores)

| Versión | Interaction bloque 2 | Resultado |
|---------|----------------------|-----------|
| Usuario inicial | `navigate` + `collect(parse())` sin clic | Sin teléfono |
| + clic teléfono | `.hidden-contact-phones_link` + `wait_timeout(3000)` | Preview a veces OK |
| + `.see-phones-btn` | Segundo clic | Timeout 30s — **no usar** (mismo botón) |
| + `wait()` teléfono | Espera formatted phone | **Aborta collect** → schema vacío |
| + `tag_response` | Captura XHR contact-phones | `telefono_ajax` en JSON preview |
| + DataDome | `country`, `solve_captcha`, `blocked()` | Preview 111341722 OK; batch masivo sigue fallando |
| Navegar URL ajax en browser | `/es/ajax/ads/{id}/contact-phones` | A veces captcha HTML → falso 963836808 — parser recomendado solo JSON `number`/`formatted` |

**Segundo interaction mínimo (usuario, obsoleto):**

```javascript
navigate(input.url);
close_popup('#didomi-notice', '#didomi-notice-agree-button');
if (el_exists('.hidden-contact-phones_link')) {
  click('.hidden-contact-phones_link');
  wait_timeout(3000);
}
collect(parse());
```

Ver archivos completos en `docs/brightdata/*.js`.
