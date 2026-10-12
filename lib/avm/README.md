# statecrm · AVM (motor de valoración) · fase 1

Paquete listo para llevar a Cursor. Diseño completo en el doc
"Valorador inmobiliario: análisis de RealAdvisor y diseño del motor propio".

## Qué hay

```
supabase/migrations/20261012120000_avm_phase1.sql   esquema, vistas, funciones y RLS
src/types.ts          twin (inmueble), comparables, resultado, fuentes usadas
src/estimate.ts       estimador en vivo + precisión (equivalente al de RealAdvisor, con €/m² de zona desde el primer paso)
src/flow.ts           micro-preguntas condicionadas; salta las que Catastro ya rellenó
src/comparables.ts    comparables con ajustes, mediana ponderada recortada, P25–P75, descuento oferta→cierre, alquiler
src/confidence.ts     confianza con penalizaciones por fuente ausente, pocos comparables, dispersión
src/environment.ts    entorno justo: a favor / en contra / avisos, puntuación informativa
src/valuate.ts        orquestador con cadena de respaldo y vista recortada para la landing
src/__tests__/        10 pruebas (vitest); una reproduce el teaser de RealAdvisor (393K €)
```

```bash
npm install
npm test          # vitest
npm run typecheck
```

## Principios

1. **Ninguna fuente es obligatoria.** `valuate()` anota en `sourcesUsed` qué eslabón usó cada capa
   (`primary` / `fallback` / `degraded` / `missing`) y `confidence.ts` penaliza según la tabla del doc.
2. **`market_listings` es independiente de captación.** Tarjetas de listado (precio, m², habitaciones,
   planta, ascensor, zona) de municipios enteros, semanal. Captación enriquece si existe.
3. **Catastro con copia local.** `catastro_buildings` / `catastro_addresses` se cargan desde las
   descargas INSPIRE por municipio; la Sede solo como respaldo con caché.
4. **Entorno en los dos sentidos y sin doble cuenta.** En fase 1–2 no toca el precio; solo el hedónico
   (fase 3) lo hará, acotado a ±10 %.
5. **Dos puertas, un motor.** `channel: 'crm' | 'landing'`; `publicView()` recorta el resultado.

## Agencia (`avm_current_tenant`)

El CRM no tiene `tenant_id` en el JWT. Los usuarios se distinguen con `auth.uid()` y `profiles.role` (`admin`, `agente`, `editor`).

Decisión de la fase A:

- Tabla `tenants`, con una fila fija de Rehabinco (`slug = 'rehabinco'`, id `00000000-0000-4000-8000-000000000001`).
- Tabla `memberships (user_id, tenant_id)` por si más adelante hay otra agencia.
- `avm_current_tenant()` resuelve, en este orden: claim `tenant_id` del JWT, membresía del usuario, y si está autenticado y no tiene ninguna, la agencia Rehabinco. Un anónimo no recibe tenant.
- TODO: eliminar antes del segundo tenant. Ese respaldo a Rehabinco solo vale mientras haya una agencia. El test `tenant-fallback` falla si `tenants` tiene más de una fila y la función sigue devolviendo el slug `rehabinco`.
- Las políticas de las tablas por agencia valen solo para `authenticated`.

Para asignar a alguien a otra agencia en el futuro: `insert into memberships (user_id, tenant_id) values (...)`. Mientras no haya fila, sigue en Rehabinco.

`market_zone_stats_refresh()` y `avm_current_tenant()` son `security definer` con `set search_path = public, extensions`.

## Tarjetas de mercado (fase B)

- Municipio de arranque: A Coruña ciudad, INE `15030`. El rastreador no llama a Idealista ni al Web Unlocker.
- Fotocasa recorre viviendas (pisos y casas). Habitaclia recorre viviendas y casas. pisos.com recorre piso y casas, en las URLs de A Coruña Capital. El portal en base de datos es `pisos`.
- Si el portal trae coordenadas, `location_precision` es `exact` y el municipio es `left(census_section, 5)`. Si no hay coordenadas, hereda el código del objetivo y, si el slug es de barrio, el centroide de `market_zones`. Un slug de municipio (`level = 'municipality'`, por ejemplo `a-coruna-capital` o Sada) no recibe centroide y el anuncio se queda con `location_precision` null.
- Los anuncios de municipios de alrededor que pisos.com cuelga de A Coruña se guardan. No se descartan por el código postal.
- El mismo piso en varios portales comparte `cluster_id`. Regla estricta: ≤ 40 m, ±3 m², mismas habitaciones o null, ±3 % de precio. Regla fuerte, además: precio idéntico, ≤ 100 m y superficie ±10 %, aunque las habitaciones no coincidan o falten. `avm_comparables()` cuenta solo activos y uno por clúster.
- El código postal de un anuncio con coordenadas exactas sale de `postcode_polygons` (`ST_Contains`). El CNIG no deja descargar esa capa (Correos, solo visualización), así que la tabla está vacía y el CP se resuelve con la geocodificación inversa de CartoCiudad, cacheada en `postcode_reverse_cache`. El CP del portal se guarda en `portal_postcode`. `postcode_centroids` se rellena con `ST_PointOnSurface` cuando hay polígonos; si el CP no está cargado, el centroide sigue pidiéndose en vivo a CartoCiudad.
- `market_zones_derive()` se lanza al final de cada pasada. No pisa filas `source = 'manual'`.
- `AVM_INGEST_FROM_CAPTACION` por defecto no está definido y el volcado no hace nada. En `true`, cada listado que captación ya procesó se copia a `market_listings` sin teléfono ni nombre.
- Pasada completa: `npx tsx scripts/avm-market-crawl.ts`. El domingo hay seis cron de Supabase, cada 10 minutos desde las 01:00 UTC, uno por portal y operación, contra `POST /api/avm/crawl` con `{ municipality_code: '15030', portal, operation }`. La ruta tiene `maxDuration = 300`.
- Un anuncio no visto en 21 días pasa a `active = false` solo cuando el portal ha terminado sin bloqueo ni tope de páginas.
- El test de upsert solo corre si `SUPABASE_URL` apunta a localhost.

## Nota para la fase D

En `market_zone_trend` la mediana de alquiler es €/m²/mes.

`grossYieldPct = rent_median × 12 / sale_median × 100`.

La mediana de alquiler es €/m²/mes. El motor de comparables valora una compraventa (€/m² de venta, con el descuento oferta→cierre). Pasarle comparables de alquiler produciría un valor de venta diminuto, así que `operation = 'rent'` no entra en ese cálculo: el precio guardado es el de venta y `rentMonthly` sale de la rentabilidad bruta. No se ha tocado el motor para forzar un camino de alquiler.

Con el 15004 anterior al clúster: 13,71 × 12 / 4.125 = 3,99 %.

## Orden de implementación en el CRM

1. Aplicar la migración (`supabase db push`). Crear la política de `tenant_id` en el JWT si aún no existe.
2. Rastreador semanal de tarjetas → `market_listings` (Fotocasa, Habitaclia y pisos.com, sin proxy
   y sin Idealista). Guardar `lat/lng` cuando el portal los da; si no, el centroide de `market_zones`.
3. `select market_zone_stats_refresh()` y programarlo mensual con pg_cron.
4. Carga INSPIRE de los municipios donde operéis (`ogr2ogr -f PostgreSQL ... building.gml`), mapeando
   `beginning` → `year_built`, `numberOfDwellings`, `numberOfFloorsAboveGround`.
5. Ruta `POST /api/avm/valuate` en Next que construye el `twin` (Catastro → anuncio → formulario) y
   llama a `valuate()` con los `deps` conectados a Supabase (`avm_zone_median`, `avm_comparables`,
   `market_discount`, `avm_environment`).
6. Formulario progresivo con `resolveFlow()` + `computeLiveEstimate()` + `computePrecision()`.
7. Guardar cada resultado en `avm_valuations` (entradas, fuentes, comparables, explicación) y medir el
   error contra ventas cerradas antes de abrir la landing pública.

## Calibración (fase 2)

- `DEFAULT_ADJUSTMENTS` en `comparables.ts` son factores iniciales conservadores; estimarlos por
  regresión sobre `market_listings` y guardarlos en una tabla `avm_adjustments` por zona/tipo.
- `market_discount` se recalcula con las ventas cerradas del CRM frente al último precio de oferta.
- Las penalizaciones de `confidence.ts` se recalibran para que la confianza prediga el error real (MAPE).
