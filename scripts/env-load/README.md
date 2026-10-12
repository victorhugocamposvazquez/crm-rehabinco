# Cargadores de entorno AVM (Fase G)

Scripts **idempotentes** (borran y recargan su capa). En producción se ejecutan en **GitHub Actions** (`.github/workflows/avm-data.yml`); en local puedes usar `.env.local` o `crawler/.env` (`SUPABASE_SERVICE_ROLE_KEY`, URL Supabase).

**Antes:** migraciones `20261013050000_avm_environment_phase_g.sql` y `20261013150000_avm_data_jobs_health.sql`.

## GitHub Actions (recomendado)

Repositorio → **Actions** → **AVM · cargas de datos** → **Run workflow**.

| Parámetro | Valores |
|-----------|---------|
| **layer** | **`entorno_completo`** (crime + OVU + SNCZI + ruido + GTFS si hay feed + OSM), o una capa suelta |
| **scope** | `spain`, `spain/galicia`, provincia (`15`), municipio (`15030`) |

Cada ejecución registra una fila en `avm_jobs` (`job_type` = `data:<capa>`, `scope`, `started_at`, `finished_at`, `rows`, `error`).

**Secrets del repo:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.

**Vercel (onboarding municipio):** `GITHUB_AVM_DATA_TOKEN` (PAT con scope `workflow` en este repo) y opcional `GITHUB_REPOSITORY=victorhugocamposvazquez/crm-rehabinco`.

### Calendario automático (UTC 05:00)

| Cuándo | Capas | Alcance |
|--------|-------|---------|
| Día **1** ene/abr/jul/oct | OSM + GTFS | `spain` |
| Día **15** ene/abr/jul/oct | Criminalidad | `spain` |
| **1 febrero** | SNCZI, ruido, vulnerabilidad | `spain` |
| **20 enero** | Secciones INE | `spain` |
| Día **5** ene/abr/jul/oct | INSPIRE | municipios `market_crawl_targets` |

### Tiempos orientativos en el runner (ubuntu, sin caché PBF)

| Capa | Duración |
|------|----------|
| OSM `spain` | 45–120 min |
| OSM CCAA (p. ej. Galicia) | 15–40 min |
| GTFS Coruña | 1–3 min |
| Criminalidad / OVU | 1–5 min |
| SNCZI (sin T10) + ruido | 20–60 min |
| Secciones INE (España) | 30–90 min |
| INSPIRE (por municipio mercado) | 5–30 min/municipio |

Orquestador: `npx tsx scripts/avm-data/run.ts --layer osm --scope spain/galicia`.

## España completa (recomendado)

```bash
brew install osmium-tool
npx tsx scripts/env-load/load-spain.ts
# todo excepto GTFS/NAP (SNCZI + MER + OSM; brew install gdal osmium-tool):
npx tsx scripts/env-load/load-spain.ts --full --skip-t10
```

Incluye criminalidad municipal (datoscrimen.es), vulnerabilidad OVU 2021 (MITMA) y OSM Geofabrik `spain-latest.osm.pbf`.

Inundación (SNCZI) y ruido (MER Lden) automáticos con GDAL:

```bash
brew install gdal
npx tsx scripts/env-load/load-spain.ts --with-flood --with-noise --skip-osm
# T10 ~800 MB: añade --skip-t10 al comando de sncsi o en load-spain con --skip-t10
```

GTFS vía NAP no se carga aquí (requiere API key); las paradas siguen en OSM.

## Orden recomendado

| # | Script | Tiempo orientativo | Notas |
|---|--------|-------------------|--------|
| 1 | OSM | 15–45 min | Descarga Galicia ~200 MB + osmium |
| 2 | GTFS | 1 min | Opcional si tienes ZIP del feed |
| 3 | SNCZI | 5–15 min | GeoJSON previo (shapefile/WFS) |
| 4 | Ruido | 2–5 min | GeoJSON MER A Coruña |
| 5 | Vulnerabilidad | <1 min | CSV OVU |
| 6 | Criminalidad | <1 min | CSV Interior |

## Comandos exactos

```bash
# 1 · OpenStreetMap (brew install osmium-tool)
npx tsx scripts/env-load/osm.ts --region spain
# solo A Coruña / Galicia OSM:
npx tsx scripts/env-load/osm.ts --region acoruna --pbf ~/Downloads/galicia-latest.osm.pbf

# 5–6 · Nacional automático
npx tsx scripts/env-load/crime.ts --fetch
npx tsx scripts/env-load/vulnerability.ts --fetch-spain

# 2 · GTFS tranvías (carpeta descomprimida con stops.txt)
npx tsx scripts/env-load/gtfs.ts --zip data/env/gtfs/tranvias-coruna

# 3 · Inundabilidad SNCZI (España, ZIP MITECO)
npx tsx scripts/env-load/sncsi.ts --fetch-spain
npx tsx scripts/env-load/sncsi.ts --fetch-spain --skip-t10 --only T100,T500

# 4 · Ruido MER Lden (España)
npx tsx scripts/env-load/noise.ts --fetch-spain
npx tsx scripts/env-load/noise.ts --fetch-spain --aglomeraciones-only

# Manual (GeoJSON previo)
npx tsx scripts/env-load/sncsi.ts --geojson data/env/snczi/galicia-costa.geojson
npx tsx scripts/env-load/noise.ts --geojson data/env/ruido/acoruna-lden.geojson --region acoruna

# 5 · Vulnerabilidad urbana (CSV: census_section,edition,indicator)
npx tsx scripts/env-load/vulnerability.ts --csv data/env/ovu/secciones.csv

# 6 · Criminalidad municipal (CSV: municipality_code,period,rate_per_1000,peer_avg)
npx tsx scripts/env-load/crime.ts --csv data/env/crime/balance.csv
```

## Comprobar en Supabase

```sql
select layer, source, category, count(*), max(loaded_at)
from environment_layers
group by 1,2,3
order by 1,2,3;

select avm_environment(43.3654271, -8.408791, '1500401001', '15030');
```

## A Coruña · conteo esperado (orden de magnitud)

Tras OSM en el bbox ciudad: miles de `shop`, cientos de `restaurant`, decenas de `supermarket`/`pharmacy`/`school`, etc. El script imprime desglose `layer:category` al terminar.

## GTFS

Si no hay feed local, **gtfs.ts** no modifica la base: las paradas siguen saliendo de OSM (`gtfs_stop`, source `OSM`).
