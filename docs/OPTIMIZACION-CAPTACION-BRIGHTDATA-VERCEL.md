# Optimización captación Bright Data (Vercel Pro + Supabase)

**Fecha:** 1 nov 2026  
**Restricción:** sin worker externo, sin Edge Functions, sin cambio de crons (`*/5` procesar, `*/15` novedades, diaria 04:30).  
**Base:** auditoría en `docs/AUDITORIA-CAPTACION-BRIGHTDATA-CPU.md` (~4 min Active CPU / 118 `procesar`).

## Línea base (antes)

| Señal | Valor |
|-------|--------|
| Ruta dominante | `/api/captacion/brightdata/procesar` |
| Active CPU periodo | ~4 min / 118 invocaciones (~2 s CPU/call) |
| Ingesta | `paralelo = 1` por página |
| Cola vacía | Lock + presupuesto + Unlocker config + query + cierre |
| Por anuncio estable | SELECT + UPDATE completo + dedup + score (+ AVM si flag) |
| Recogida | `anotarLote` + `sumarVistos` = 2 lecturas + 2 escrituras |
| Cheerio | `$("body").text()` siempre al cerrar parse |

## Qué se implementó (sin deploy ni cambio de cron)

### 1. Early exit
- `hayTrabajoPendienteCola` / `hayRecogidasAbiertas` antes de Unlocker y presupuesto.
- Si cola vacía y no hay recogidas abiertas: omitir con motivo `cola_vacia` (sin lock).
- Si solo quedan recogidas abiertas: lock breve + `intentarCerrarRecogidasAbiertas`.
- Re-check tras adquirir lock.

### 2. Incremental
- `anuncioSinCambiosRelevantes`: sin cambios de precio/contenido/contacto/ubicación y no reaparición → touch (`visto_en`, zona, fecha portal si aplica).
- Omite historial, dedup, score y AVM.
- Sigue detectando bajadas, subidas, retiradas (cierre) y reapariciones.

### 3. Supabase
- Batch `cargarPreviosAnuncios` (1 SELECT por página).
- Cache `pasadaCompletaAnterior` (1 query por lote, no por anuncio).
- Historial en un solo `insert` múltiple.

### 4. Concurrencia
- `INGESTA_PARALELO_DEFAULT = 3` (tope duro 5 en código).

### 5. Ráfagas / recogidas
- `anotarYSumarVistos`: una lectura + una escritura.

### 6. Cheerio
- `sin_resultados` con regex sobre HTML; sin `$("body").text()`.

### 7. Observabilidad
- Log JSON `{ captacion_rafaga: { ms_*, anuncios, sin_cambios, nuevos, … } }` por ráfaga (sin PII).

## Plan de reversión

1. Revertir el commit de esta optimización en `main` (o cherry-pick inverso).
2. No hace falta tocar `pg_cron` ni Vault.
3. Señales de rollback: subida de `errores` en `captacion_rafagas`, caída de `sin_cambios` a 0 con cola llena, o avisos de zonas sospechosas anómalos.

## Cómo medir Active CPU (después del deploy)

1. Vercel → proyecto **crm-rehabinco** → Observability / Fluid Active CPU filtrando `/api/captacion/brightdata/procesar`.
2. Comparar 48–72 h post-deploy vs periodo de la auditoría.
3. En logs de Function, filtrar `captacion_rafaga` y agregar `sin_cambios / anuncios` y `ms_*`.
4. Distinguir: invocaciones `cola_vacia` (casi 0 CPU) vs ráfagas con páginas.

## Tabla de optimizaciones

| Optimización | Archivos | Pruebas | Riesgo | Ahorro |
|--------------|----------|---------|--------|--------|
| Early exit cola vacía | `cola-pendiente.ts`, `rafagas.ts` | unit métricas/config; manual: cron sin pendientes → motivo `cola_vacia` | Bajo: cierre de recogidas sigue cubierto | **Estimado** ~30–50 % de invocaciones `procesar` (las vacías) dejan de hacer Cheerio/presupuesto/Unlocker. Active CPU de esas calls ≈ overhead de 1–2 counts. **Medido:** pendiente post-deploy |
| Incremental sin cambios | `incremental.ts`, `guardar.ts` | `incremental.test.ts` (precio, tel, retirada, hash) | Medio-bajo: campos fuera del comparador podrían retrasar score; comparador incluye precio, hash, contacto, geo, anunciante | **Estimado** en pasada diaria estable: 70–90 % anuncios en touch ligero → ~4–8 queries/anuncio evitadas (dedup+score). **Medido:** pendiente (`sin_cambios` en logs) |
| Batch previos + pasada cache | `guardar.ts`, `ingestar.ts` | cubierto por flujo + tests upsert/incremental | Bajo | **Estimado** −29 SELECTs de pasada/página (30→1) y −29 SELECTs previos/página. **Medido:** pendiente |
| Historial batch insert | `guardar.ts` | upsert historial existente | Bajo | **Estimado** 1 RTT por anuncio con cambios (antes N campos). **Medido:** pendiente |
| Ingesta paralelo 3 | `rafaga-config.ts`, `ingestar.ts` | `cola-pendiente.test.ts` rango 1–5 | Medio: más carga puntual en Supabase; capped a 5 | **Estimado** wall-clock ráfaga −30–50 % en fase ingesta; Active CPU similar o ligeramente ↑ por solape, duración Function ↓. **Medido:** pendiente |
| `anotarYSumarVistos` | `recogidas.ts`, `paginas.ts` | cierre-listado tests existentes | Bajo (misma semántica 48 h) | **Estimado** −1 SELECT −1 UPDATE por página de listado. **Medido:** pendiente |
| Cheerio sin body.text | `parse-listado.ts` | `parse-listado.test.ts` sin_resultados + fixture Oleiros | Bajo | **Estimado** −5–15 % CPU parse en páginas vacías/errores; en páginas con items, evita walk del body. **Medido:** pendiente |
| Métricas por fase | `metricas-rafaga.ts`, `paginas.ts`, `rafagas.ts` | unit acumular | Bajo (1 log/ráfaga) | Sin ahorro directo; habilita **medir** CPU/fases post-deploy |

### Totales orientativos (solo estimados)

| Escenario | Active CPU `procesar` vs base |
|-----------|-------------------------------|
| Día con muchas ráfagas `cola_vacia` | −40–60 % (invocaciones baratas) |
| Pasada completa diaria (mucho anuncio estable) | −25–45 % en fase ingesta/CPU Function |
| Pico con muchos anuncios nuevos | −10–20 % (batch + paralelo; poco incremental) |

**Nada de lo anterior está medido en Vercel todavía** (sin deploy). Tras autorizar deploy, comparar Fluid Active CPU 48–72 h y rellenar la columna “Medido”.

## Archivos tocados

- `lib/captacion/brightdata/cola-pendiente.ts` (+ test)
- `lib/captacion/brightdata/metricas-rafaga.ts`
- `lib/captacion/brightdata/rafagas.ts`
- `lib/captacion/brightdata/paginas.ts`
- `lib/captacion/brightdata/ingestar.ts`
- `lib/captacion/brightdata/recogidas.ts`
- `lib/captacion/brightdata/rafaga-config.ts`
- `lib/captacion/brightdata/parse-listado.ts` (+ test)
- `lib/captacion/pipeline/guardar.ts`
- `lib/captacion/pipeline/incremental.ts` (+ test)
- `docs/OPTIMIZACION-CAPTACION-BRIGHTDATA-VERCEL.md` (este)

## Validación pre-deploy (1 nov 2026)

### Defectos encontrados y corregidos

1. **Incremental incompleto:** no comparaba `tipo`, `operacion`, `banos`, `planta`, `superficie`/`habitaciones` de forma explícita; el SELECT de previos tampoco los traía.
2. **Hash vs listado incompleto:** descripción/superficie nulas del listado invalidaban el hash y forzaban (o bloqueaban mal) el camino ligero → `entranteEfectivoParaComparar`.
3. **Concurrencia + batch:** dos filas con el mismo `externo_id` en una página + paralelo 3 podían hacer doble INSERT (índice no UNIQUE) → dedupe por `externo_id` en `ingestar`.
4. **Early-exit testable:** lógica extraída a `decidirEarlyExit` para garantizar cierre de recogidas con cola vacía.

### Verificaciones

| Check | Resultado |
|-------|-----------|
| `npm run test:captacion` | 119/119 pass |
| `tsc` en captación | sin errores |
| `npm run build` | OK (warnings previos no bloqueantes) |
| Cambios en crons / migraciones schedule | ninguno |
| Deploy | no ejecutado |

### Recomendación

**GO** a producción tras commit + push autorizado, con monitorización 48–72 h de `captacion_rafaga` y Fluid Active CPU.

## No hecho (a propósito)

- Cambiar schedules de `pg_cron`.
- Deploy a producción.
- Migraciones de esquema (p. ej. UNIQUE `(portal_id, externo_id)` queda como mejora opcional).
- Worker externo / Edge Functions.
