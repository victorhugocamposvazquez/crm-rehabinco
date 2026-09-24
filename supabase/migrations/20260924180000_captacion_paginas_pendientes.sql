create table if not exists public.captacion_paginas_pendientes (
  id uuid primary key default gen_random_uuid(),
  recogida_id text not null references public.captacion_recogidas (collection_id) on delete cascade,
  url text not null,
  zona_id text not null,
  page integer not null,
  estado text not null default 'pendiente',
  unique (recogida_id, url),
  constraint captacion_paginas_pendientes_estado_check check (estado in ('pendiente', 'hecha', 'error'))
);

alter table public.captacion_recogidas
  add column if not exists vistos jsonb not null default '{}'::jsonb;

alter table public.captacion_paginas_pendientes enable row level security;
revoke all on table public.captacion_paginas_pendientes from anon, public, authenticated;

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
    body := '{}'::jsonb
  );
  $cron$
);
