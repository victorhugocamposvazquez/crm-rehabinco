# Validación pre-deploy: optimización captación Bright Data

**Fecha:** 1 nov 2026  
**Resultado:** **GO**  
**Deploy:** no ejecutado  
**Docs relacionadas:** `OPTIMIZACION-CAPTACION-BRIGHTDATA-VERCEL.md`, `AUDITORIA-CAPTACION-BRIGHTDATA-CPU.md`

---

## Tests y build

| Check | Resultado |
|-------|-----------|
| `npm run test:captacion` | **119/119 pass** (0 fallidos) |
| TypeScript (`tsc`, captación) | **OK** |
| `npm run build` | **OK** (warnings ESLint/`<img>` previos, no bloquean) |
| Deploy | **No ejecutado** |

---

## Problemas detectados y corregidos

1. **Incremental incompleto** — No forzaba pipeline pesado ante cambios de `tipo`, `operacion`, `banos`, `planta`; el SELECT de previos no traía esos campos. Corregido en `incremental.ts` + `SELECT_PREVIO_ANUNCIO`.
2. **Hash vs listado incompleto** — Descripción/superficie nulas del listado rompían el hash frente a datos de ficha. Añadido `entranteEfectivoParaComparar`.
3. **Doble INSERT con paralelo 3** — Batch de previos + mismo `externo_id` duplicado en página (índice no UNIQUE). Dedupe por `externo_id` en `ingestar.ts`.
4. **Early-exit y retirados** — Extraída `decidirEarlyExit`: cola vacía + recogidas abiertas → cierra (retirados); solo omite Unlocker si no hay trabajo ni recogidas.

---

## Seguridad funcional

| Punto | Estado |
|-------|--------|
| Precio, superficie, descripción, contacto, geo, tipo, baños, retirada/reaparición | Cubiertos por tests de incremental |
| Score / dedup / AVM solo si hay cambios reales | Camino ligero los omite; cambios → pipeline completo |
| Concurrencia 3 | Dedupe + lock de ráfaga; upsert de contactos por `clave` |
| Early exit no bloquea cierre ni cola | Test de decisión + re-check tras lock |
| Locks / recuperación | TTL 6 min; `finally` libera; páginas fallidas vuelven a `pendiente` |
| Métricas before/after | Log `captacion_rafaga` con `sin_cambios`, `ms_*`, `nuevos`, `motivo` |

---

## Riesgos pendientes (aceptables)

- No hay constraint UNIQUE en `(portal_id, externo_id)` en BD (mejora opcional post-deploy).
- Active CPU real aún **no medido** en Vercel (sin deploy).
- Score de un contacto tocado por 2 anuncios nuevos en el mismo lote: último upsert gana (idempotente; ya ocurría en serie).

---

## Crons

**No alterados.** Siguen:

| Job | Schedule |
|-----|----------|
| `captacion-idealista-listado` | `30 4 * * *` (04:30 UTC) |
| `captacion-idealista-novedades` | `*/15 * * * *` |
| `captacion-idealista-procesar` | `*/5 * * * *` |

Sin cambios en migraciones de schedule ni en `vercel.json` de captación.

---

## Captación automática

**Intacta:** mismos endpoints, mismos `pg_cron`, trigger diario + novedades 15 min + procesar 5 min. Solo cambia el coste interno de cada ráfaga.

---

## Recomendación

**GO** a producción tras commit + push autorizado.

Tras el deploy, monitorizar 48–72 h:

1. Fluid Active CPU de `/api/captacion/brightdata/procesar`
2. Ratio `sin_cambios / anuncios` en logs `captacion_rafaga`
3. Errores / motivos en `captacion_rafagas`

---

## Despliegue 1 nov 2026

| Campo | Valor |
|-------|--------|
| Rollback SHA | `a6829ade7f7f85cbe936bda4a56b5f0e872a4974` |
| SHA en `main` | `497d9537e25101c8e6a085b1a2f31d780f75ed07` |
| Push | OK (`main`) |
| Tests / build pre-push | 119/119 + build OK |
| Crons tocados | ninguno |
| Estado Vercel | **Account is blocked** / `DEPLOYMENT_DISABLED` (HTTP 402) |
| Site `crm.rehabinco.es` | 402 — no sirve tráfico |
| Comprobaciones post-deploy | **bloqueadas** hasta desbloquear la cuenta |

Acción requerida: desbloquear la cuenta/proyecto en Vercel (cuota Fluid / billing). Luego verificar deployment Ready del SHA `497d953…` y continuar el plan de monitorización 48–72 h. No hace falta rollback de código por la optimización; el fallo es de cuenta, no del commit.
