-- Lock para que cron y el navegador no pisen el mismo paso de zona.
-- No toca clasificación DH ni tablas del CRM de visitas.

alter table public.catastro_zone_sessions
  add column if not exists claimed_until timestamptz;

create index if not exists idx_catastro_zone_sessions_reanudables
  on public.catastro_zone_sessions (status, expires_at)
  where status in ('paused', 'running', 'prepared', 'upstream_paused');

comment on column public.catastro_zone_sessions.claimed_until is
  'Hasta cuándo un isolate tiene el paso. Permite continuar en segundo plano sin el CRM abierto.';
