-- Bloqueo de ráfagas, historial y timeout del cron de procesar (pg_net).

create table if not exists public.captacion_locks (
  clave text primary key,
  expira_en timestamptz not null
);

comment on table public.captacion_locks is 'Bloqueos cortos del worker de captación (p. ej. una ráfaga de procesar).';

create table if not exists public.captacion_rafagas (
  id uuid primary key default gen_random_uuid(),
  iniciada_en timestamptz not null default now(),
  terminada_en timestamptz,
  paginas integer not null default 0,
  errores integer not null default 0,
  ok boolean,
  motivo text,
  duracion_ms integer
);

comment on table public.captacion_rafagas is 'Cada ejecución del endpoint brightdata/procesar (ráfaga Unlocker).';

create index if not exists idx_captacion_rafagas_iniciada on public.captacion_rafagas (iniciada_en desc);

alter table public.captacion_locks enable row level security;
alter table public.captacion_rafagas enable row level security;
revoke all on table public.captacion_locks from anon, public, authenticated;
revoke all on table public.captacion_rafagas from anon, public, authenticated;

do $$
begin
  perform cron.unschedule('captacion-idealista-procesar');
exception
  when others then null;
end $$;

select cron.schedule(
  'captacion-idealista-procesar',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := replace(
      (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_trigger_url' limit 1),
      '/trigger',
      '/procesar'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cron$
);
