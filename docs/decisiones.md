# Decisiones captación crawler

- `captacion_alertas` = zonas/búsquedas contratadas; `captacion_notificaciones` = avisos entregados al comercial (distinto propósito, no unificados).
- `claveContacto`: prefijos `tel:`/`nom:` con E.164 (sustituye `t:`/`n:` legacy).
- `fusionarAnuncio` → `upsertAnuncio` con historial por campo y `portal_id`.
- Idealista API aislado en `legacy/`; cron Vercel eliminado; scheduler en worker.
- `portal_id` FK a `captacion_portales`; columna `fuente` denormalizada por compatibilidad.
- Tipos compartidos: import `@crm/*` desde `lib/` vía alias tsconfig del crawler.
- Dockerfile con contexto en raíz del repo; runtime con `tsx` por imports cruzados.
- Sin adaptadores hasta fixture real por portal (sondeo primero).
