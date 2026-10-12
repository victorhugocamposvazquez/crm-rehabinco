-- Objetivos del rastreo de tarjetas y centroides de zona (sin inventar coordenadas).

create table if not exists market_crawl_targets (
  id                  uuid primary key default gen_random_uuid(),
  municipality_code   text not null unique,
  name                text not null,
  portals             text[] not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

insert into market_crawl_targets (municipality_code, name, portals)
values (
  '15030',
  'A Coruña',
  array['fotocasa', 'habitaclia', 'pisos.com', 'idealista']
)
on conflict (municipality_code) do update
  set name = excluded.name,
      portals = excluded.portals,
      active = true;

create table if not exists market_zones (
  portal              text not null,
  zone_slug           text not null,
  municipality_code   text not null,
  lat                 double precision,
  lng                 double precision,
  census_section      text,
  postcode            text,
  primary key (portal, zone_slug, municipality_code)
);

alter table market_zones enable row level security;

do $$ begin
  create policy market_zones_read on market_zones for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Semanal: la ruta del CRM avanza unas páginas. El secreto es el de los otros crons.
do $$
begin
  perform cron.unschedule('avm-market-listings-weekly');
exception when others then null;
end $$;

select cron.schedule(
  'avm-market-listings-weekly',
  '0 5 * * 1',
  $cron$
  select net.http_post(
    url := coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name = 'avm_crawl_url' limit 1),
      'https://crm-rehabinco-two.vercel.app/api/avm/crawl'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1),
        ''
      )
    ),
    body := '{"maxPages":6}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

do $$
begin
  perform cron.unschedule('market_zone_stats_monthly');
exception when others then null;
end $$;

select cron.schedule(
  'market_zone_stats_monthly',
  '15 3 1 * *',
  $$select market_zone_stats_refresh()$$
);
