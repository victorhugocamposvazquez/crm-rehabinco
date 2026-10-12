-- Ajusta el rastreo de tarjetas: objetivos, zonas, pasadas y secciones censales.
-- No modifica la migración de la fase A.

alter table market_crawl_targets add column if not exists operations text[];
alter table market_crawl_targets add column if not exists last_run timestamptz;
update market_crawl_targets set operations = '{sale,rent}' where operations is null;
alter table market_crawl_targets alter column operations set default '{sale,rent}';
alter table market_crawl_targets alter column operations set not null;

alter table market_crawl_targets drop constraint if exists market_crawl_targets_pkey;
alter table market_crawl_targets drop constraint if exists market_crawl_targets_municipality_code_key;
alter table market_crawl_targets drop column if exists id;
alter table market_crawl_targets drop column if exists created_at;
alter table market_crawl_targets add primary key (municipality_code);

insert into market_crawl_targets (municipality_code, name, portals, operations, active, last_run)
values ('15030', 'A Coruña', array['fotocasa', 'habitaclia', 'pisos'], array['sale', 'rent'], true, null)
on conflict (municipality_code) do update
  set name = excluded.name,
      portals = excluded.portals,
      operations = excluded.operations,
      active = true;

alter table market_zones add column if not exists name text;
alter table market_zones drop constraint if exists market_zones_pkey;
alter table market_zones add primary key (portal, zone_slug);

create table if not exists market_crawl_runs (
  id                  uuid primary key default gen_random_uuid(),
  municipality_code   text not null,
  portal              text not null,
  operation           text not null,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  pages               int not null default 0,
  cards_seen          int not null default 0,
  cards_upserted      int not null default 0,
  cards_exact         int not null default 0,
  cards_zone          int not null default 0,
  error               text
);

alter table market_crawl_runs enable row level security;
do $$ begin
  create policy market_crawl_runs_read on market_crawl_runs for select to authenticated using (true);
exception when duplicate_object then null; end $$;

create table if not exists ine_census_sections (
  code  text primary key,
  geom  geometry(MultiPolygon, 4326) not null
);
create index if not exists ine_census_sections_geom_idx on ine_census_sections using gist (geom);
alter table ine_census_sections enable row level security;
do $$ begin
  create policy ine_census_sections_read on ine_census_sections for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Las coordenadas que trae el portal son exactas. pisos.com pasa a llamarse pisos.
update market_listings set portal = 'pisos' where portal = 'pisos.com';
update market_listings
set location_precision = 'exact'
where lat is not null and lng is not null and location_precision is distinct from 'exact';

create or replace function market_listings_assign_section() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  seccion text;
begin
  if new.location_precision = 'exact' and new.lat is not null and new.lng is not null then
    select s.code into seccion
    from ine_census_sections s
    where ST_Contains(s.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326))
    limit 1;
    if seccion is not null then
      new.census_section := seccion;
    end if;
  elsif new.location_precision = 'zone' and new.zone_slug is not null then
    select z.census_section into seccion
    from market_zones z
    where z.portal = new.portal and z.zone_slug = new.zone_slug and z.census_section is not null
    limit 1;
    if seccion is not null then
      new.census_section := seccion;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists market_listings_assign_section on market_listings;
create trigger market_listings_assign_section
  before insert or update on market_listings
  for each row execute function market_listings_assign_section();

-- Domingo 03:00 Europe/Madrid en horario de verano (01:00 UTC).
do $$ begin
  perform cron.unschedule('avm-market-listings-weekly');
exception when others then null; end $$;

select cron.schedule(
  'avm-market-listings-weekly',
  '0 1 * * 0',
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
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

-- Día 1 a las 04:00 Europe/Madrid en horario de verano (02:00 UTC).
do $$ begin
  perform cron.unschedule('market_zone_stats_monthly');
exception when others then null; end $$;

select cron.schedule(
  'market_zone_stats_monthly',
  '0 2 1 * *',
  $$select market_zone_stats_refresh()$$
);
