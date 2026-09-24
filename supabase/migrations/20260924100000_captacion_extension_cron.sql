-- Teléfono capturado por la extensión, token por usuario, estimado de zona y cron del listado.

alter table public.profiles
  add column if not exists token_extension text;

create unique index if not exists profiles_token_extension_unico
  on public.profiles (token_extension)
  where token_extension is not null;

alter table public.captacion_anuncios
  add column if not exists telefono_capturado_por uuid references public.profiles (id) on delete set null,
  add column if not exists telefono_capturado_en timestamptz;

alter table public.captacion_brightdata_zonas
  add column if not exists estimado integer;

alter table public.captacion_recogidas
  add column if not exists incompleta boolean not null default false;

-- El listado lo dispara el CRM, no el panel de Bright Data.
-- pg_cron en Supabase corre en UTC. 05:00 y 13:00 UTC son las 07:00 y 15:00 en horario de verano (CEST).
-- En invierno (CET) cámbialo a '0 6,14 * * *'.
-- Secretos en vault, antes de que el job tenga efecto:
--   select vault.create_secret('https://crm.rehabinco.es/api/captacion/brightdata/trigger', 'captacion_trigger_url');
--   select vault.create_secret('<el mismo CRON_SECRET de Vercel>', 'captacion_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('captacion-idealista-listado');
exception
  when others then null;
end $$;

select cron.schedule(
  'captacion-idealista-listado',
  '0 5,13 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_trigger_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
