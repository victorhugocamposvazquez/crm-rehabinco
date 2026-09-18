# Runbook captación crawler

## Puesta en marcha (orden)

1. **Migración** — Ejecutar `supabase/migrations/20260917120000_captacion_crawler.sql` en el SQL Editor de Supabase. Si falla porque alguna tabla ya existía con otra forma, copiar el error tal cual antes de retocar el SQL.
2. **`crawler/.env`** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROXY_URL`, `TZ=Europe/Madrid` (ver `.env.example`). Railway no hace falta al inicio: sondeo y primera pasada en local.
3. **Proxy** (producción) — Contratar proxy residencial sticky con salida en España. Para pruebas iniciales ver «Modo sin proxy».
4. **URL de listado** — No inventar URLs. Entrar al portal, buscar municipio, activar filtro de particulares y copiar la URL exacta de la barra del navegador. Para Habitaclia (flojo en Galicia): municipio mediano de Cataluña con ~30–50 anuncios de particulares; luego se dan de alta las zonas reales.
5. **Sondeo** — `cd crawler && npm run sondeo -- --portal {portal} --url "..."`. Las fixtures quedan en `crawler/tests/fixtures/{portal}/` (no pegar en chat).
6. **Por portal** — Adaptador + test de contrato + `docs/portales/{portal}.md` + primera pasada de zona prueba. Un portal cada vez.

## Tests (runners separados)

| Comando | Runner | Alcance |
|---------|--------|---------|
| `npm test` | node:test + tsx (`scripts/run-crm-tests.mjs`) | `lib/**`, excluye `crawler/**` |
| `npm run test:crawler` | vitest (`crawler/vitest.config.ts`) | solo `crawler/tests/**` y `crawler/src/**/*.test.ts` |

## Desplegar worker (Docker en VPS)

```bash
# Desde la raíz del repo
docker build -f crawler/Dockerfile -t crm-captacion-crawler .
docker run -d --name captacion-crawler --restart unless-stopped \
  -e NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  -e PROXY_URL=http://user:pass@host:port \
  -e WORKER_ID=vps-1 \
  -e TZ=Europe/Madrid \
  crm-captacion-crawler
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Clave service_role (solo worker) |
| `PROXY_URL` | No | Proxy residencial sticky; vacío = conexión directa (solo pruebas) |
| `WORKER_ID` | No | Identificador del worker |
| `TZ` | No | `Europe/Madrid` |
| `CRAWL_LOOP_MS` | No | Pausa entre ciclos (default 5000) |

## Dar de alta una zona

1. Aplicar migración `20260917120000_captacion_crawler.sql` en Supabase.
2. Activar portal: `update captacion_portales set activo=true where id='habitaclia'`.
3. Crear alerta en CRM con `portal_id`, municipio, operación y `cadencia_minutos`.
4. El scheduler del worker encola listados cuando `proxima_ejecucion` vence.

## Sondeo de portal (antes de parser)

```bash
cd crawler && npm install
PROXY_URL=http://user:pass@host:port npm run sondeo -- \
  --portal habitaclia \
  --url "URL_DE_LISTADO_DE_PRUEBA"
```

Fixtures en `crawler/tests/fixtures/{portal}/`.

## Modo sin proxy (pruebas)

**No usar en producción.** Validación inicial desde conexión doméstica.

- `PROXY_URL` vacío: log al arrancar «sin proxy, conexión directa»; HTTP y browser van directos.
- Una sesión por portal (cookies + user-agent fijos); concurrencia global 1 (`CRAWL_BATCH` forzado a 1).
- Ritmo mínimo 8–15 s entre peticiones (no configurable por debajo de 8 s).
- 403 o captcha: pausa el portal 30 min, sigue con otros portales; `crawl_runs.proxy_sesion = null`.
- Sondeo: solo ejecuta `undici` directo; `undici+proxy` y `playwright+proxy` salen como «omitido (sin proxy)».

## Añadir un portal nuevo

1. Sondeo → fixture real en `tests/fixtures/{portal}/`.
2. Adaptador en `crawler/src/adapters/{portal}.ts` + registro en `registry`.
3. Test de contrato sobre fixture en `crawler/tests/{portal}.test.ts`.
4. Documentar en `docs/portales/{portal}.md`.
5. `insert into captacion_portales ...` + `activo=true`.
