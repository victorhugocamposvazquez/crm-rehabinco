-- Retoques B.1: municipio real, zonas derivadas, clúster entre portales, seis crons.
-- Fase C: caché de Catastro, centroides de código postal y zona de un punto.
-- No modifica las migraciones ya aplicadas.

alter table market_zones add column if not exists source text not null default 'manual';
alter table market_zones add column if not exists level text not null default 'zone';
alter table market_zones drop constraint if exists market_zones_source_chk;
alter table market_zones drop constraint if exists market_zones_level_chk;
alter table market_zones add constraint market_zones_source_chk check (source in ('manual', 'derived'));
alter table market_zones add constraint market_zones_level_chk check (level in ('zone', 'municipality'));

-- El callejero de los-rosales caía fuera de la ciudad. No había fila; se borra por si reaparece.
delete from market_zones where zone_slug in ('los-rosales', 'os-rosales');

-- Con sección censal, el municipio es el del INE. Sin coordenadas se queda el del objetivo.
update market_listings
set municipality_code = left(census_section, 5)
where census_section is not null
  and municipality_code is distinct from left(census_section, 5);

alter table market_listings add column if not exists cluster_id uuid;
create index if not exists market_listings_cluster_idx on market_listings (cluster_id);

create or replace function market_listings_assign_section() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  seccion text;
  nivel text;
  grupo uuid;
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
    select z.census_section, z.level into seccion, nivel
    from market_zones z
    where z.portal = new.portal and z.zone_slug = new.zone_slug
    limit 1;
    if nivel = 'municipality' then
      new.lat := null;
      new.lng := null;
      new.location_precision := null;
      new.census_section := null;
    elsif seccion is not null then
      new.census_section := seccion;
    end if;
  end if;

  if new.census_section is not null then
    new.municipality_code := left(new.census_section, 5);
  end if;

  if new.lat is not null and new.lng is not null and new.surface is not null and new.price > 0 then
    select l.cluster_id into grupo
    from market_listings l
    where l.active
      and l.cluster_id is not null
      and l.operation = new.operation
      and l.main_type = new.main_type
      and (l.portal, l.portal_id) is distinct from (new.portal, new.portal_id)
      and l.geom is not null
      and ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography, 40)
      and l.surface is not null
      and abs(l.surface - new.surface) <= 3
      and (l.rooms is null or new.rooms is null or l.rooms = new.rooms)
      and l.price > 0
      and abs(l.price - new.price) <= 0.03 * least(l.price, new.price)
    order by l.last_seen desc
    limit 1;
  end if;

  if grupo is not null then
    new.cluster_id := grupo;
  elsif new.cluster_id is null then
    new.cluster_id := gen_random_uuid();
  end if;

  return new;
end $$;

-- Slugs de municipio o de parroquia de alrededor: sin centroide.
-- Un anuncio que solo traiga ese slug se queda con location_precision null.
insert into market_zones (portal, zone_slug, municipality_code, name, lat, lng, source, level)
select p.portal, s.slug, s.municipality_code, s.slug, null, null, 'manual', 'municipality'
from (values
  ('a-coruna-capital', '15030'),
  ('sada', '15075'),
  ('bergondo', '15008'),
  ('culleredo', '15031'),
  ('o-burgo', '15031'),
  ('almeiras', '15031'),
  ('perillo', '15058'),
  ('maianca', '15058'),
  ('dexo-lorbe', '15058'),
  ('lians-porto-de-santa-cruz', '15058'),
  ('dorneda', '15058'),
  ('pastoriza', '15005'),
  ('a-lamela', '15058'),
  ('a-campanilla', '15058'),
  ('a-silva', '15058')
) as s(slug, municipality_code)
cross join (values ('fotocasa'), ('habitaclia'), ('pisos')) as p(portal)
where exists (
  select 1 from market_listings l
  where l.portal = p.portal and l.zone_slug = s.slug
) or s.slug = 'a-coruna-capital'
on conflict (portal, zone_slug) do update
  set level = 'municipality',
      lat = null,
      lng = null,
      source = 'manual',
      municipality_code = excluded.municipality_code
  where market_zones.level is distinct from 'zone' or market_zones.lat is null;

create or replace function market_zones_derive() returns int
language plpgsql
set search_path = public, extensions
as $$
declare
  n int;
begin
  with grupos as (
    select
      l.portal,
      l.zone_slug,
      percentile_cont(0.5) within group (order by l.lat) as lat,
      percentile_cont(0.5) within group (order by l.lng) as lng,
      (
        select mode() within group (order by p.postcode)
        from market_listings p
        where p.portal = l.portal
          and p.zone_slug = l.zone_slug
          and p.location_precision = 'exact'
          and p.postcode is not null
      ) as postcode
    from market_listings l
    where l.location_precision = 'exact'
      and l.lat is not null
      and l.lng is not null
      and l.zone_slug is not null
    group by l.portal, l.zone_slug
    having count(*) >= 5
  ),
  ubicados as (
    select g.portal, g.zone_slug, g.lat, g.lng, g.postcode, s.code as census_section
    from grupos g
    join lateral (
      select code
      from ine_census_sections s
      where ST_Contains(s.geom, ST_SetSRID(ST_MakePoint(g.lng, g.lat), 4326))
      limit 1
    ) s on true
  )
  insert into market_zones (portal, zone_slug, municipality_code, name, lat, lng, census_section, postcode, source, level)
  select portal, zone_slug, left(census_section, 5), zone_slug, lat, lng, census_section, postcode, 'derived', 'zone'
  from ubicados
  on conflict (portal, zone_slug) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        census_section = excluded.census_section,
        postcode = excluded.postcode,
        municipality_code = excluded.municipality_code,
        source = 'derived',
        level = 'zone'
    where market_zones.source is distinct from 'manual'
      and market_zones.level is distinct from 'municipality';
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function market_listings_recluster() returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  rec record;
  ra uuid;
  rb uuid;
  x uuid;
  n int;
begin
  alter table market_listings disable trigger market_listings_assign_section;
  drop table if exists _avm_uf;
  create temp table _avm_uf (id uuid primary key, parent uuid not null) on commit drop;
  insert into _avm_uf (id, parent)
  select id, id from market_listings;

  for rec in
    select a.id as a, b.id as b
    from market_listings a
    join market_listings b
      on a.id < b.id
     and a.active and b.active
     and a.operation = b.operation
     and a.main_type = b.main_type
     and a.geom is not null and b.geom is not null
     and ST_DWithin(a.geom, b.geom, 40)
     and a.surface is not null and b.surface is not null
     and abs(a.surface - b.surface) <= 3
     and (a.rooms is null or b.rooms is null or a.rooms = b.rooms)
     and a.price > 0 and b.price > 0
     and abs(a.price - b.price) <= 0.03 * least(a.price, b.price)
  loop
    ra := rec.a;
    loop
      select parent into x from _avm_uf where id = ra;
      exit when x = ra or x is null;
      ra := x;
    end loop;
    rb := rec.b;
    loop
      select parent into x from _avm_uf where id = rb;
      exit when x = rb or x is null;
      rb := x;
    end loop;
    if ra is not null and rb is not null and ra <> rb then
      if ra < rb then
        update _avm_uf set parent = ra where id = rb;
      else
        update _avm_uf set parent = rb where id = ra;
      end if;
    end if;
  end loop;

  loop
    update _avm_uf u
    set parent = p.parent
    from _avm_uf p
    where u.parent = p.id and p.parent <> p.id;
    exit when not found;
  end loop;

  update market_listings l
  set cluster_id = u.parent
  from _avm_uf u
  where l.id = u.id;

  alter table market_listings enable trigger market_listings_assign_section;
  select count(distinct cluster_id) into n from market_listings;
  return n;
exception when others then
  alter table market_listings enable trigger market_listings_assign_section;
  raise;
end $$;

create or replace function avm_comparables(
  p_lat        double precision,
  p_lng        double precision,
  p_main_type  avm_main_type,
  p_surface    numeric,
  p_operation  avm_operation default 'sale',
  p_min_n      int default 8,
  p_max_n      int default 20,
  p_months     int default 6
) returns table (
  listing_id      uuid,
  portal          text,
  title           text,
  price           numeric,
  surface         numeric,
  price_per_m2    numeric,
  rooms           smallint,
  floor           smallint,
  has_elevator    boolean,
  has_garage      boolean,
  is_exterior     boolean,
  condition_hint  text,
  last_seen       date,
  distance_m      numeric,
  radius_m        int
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_radius int;
  v_count int;
begin
  foreach v_radius in array array[300, 600, 1000, 1500, 3000] loop
    select count(distinct coalesce(l.cluster_id, l.id)) into v_count
    from market_listings l
    where l.operation = p_operation and l.main_type = p_main_type
      and l.surface between p_surface * 0.7 and p_surface * 1.3
      and l.last_seen >= current_date - (p_months || ' months')::interval
      and l.geom is not null
      and ST_DWithin(l.geom, v_point, v_radius);
    exit when v_count >= p_min_n;
  end loop;

  return query
  select u.listing_id, u.portal, u.title, u.price, u.surface, u.price_per_m2,
         u.rooms, u.floor, u.has_elevator, u.has_garage, u.is_exterior, u.condition_hint,
         u.last_seen, u.distance_m, v_radius
  from (
    select distinct on (coalesce(l.cluster_id, l.id))
      l.id as listing_id,
      l.portal,
      l.title,
      l.price,
      l.surface,
      round(l.price / nullif(l.surface, 0), 2) as price_per_m2,
      l.rooms,
      l.floor,
      l.has_elevator,
      l.has_garage,
      l.is_exterior,
      l.condition_hint,
      l.last_seen,
      round(ST_Distance(l.geom, v_point)::numeric, 0) as distance_m,
      (
        (l.title is not null)::int + (l.rooms is not null)::int + (l.floor is not null)::int
        + (l.has_elevator is not null)::int + (l.has_garage is not null)::int
        + (l.is_exterior is not null)::int + (l.condition_hint is not null)::int
        + (l.postcode is not null)::int + (l.bathrooms is not null)::int
        + (l.has_terrace is not null)::int
      ) as llenos
    from market_listings l
    where l.operation = p_operation and l.main_type = p_main_type
      and l.surface between p_surface * 0.7 and p_surface * 1.3
      and l.last_seen >= current_date - (p_months || ' months')::interval
      and l.geom is not null
      and ST_DWithin(l.geom, v_point, v_radius)
    order by coalesce(l.cluster_id, l.id), l.last_seen desc, llenos desc
  ) u
  order by u.distance_m
  limit p_max_n;
end $$;

drop materialized view if exists market_zone_stats cascade;

create materialized view market_zone_stats as
with ranked as (
  select
    l.last_seen,
    l.operation,
    l.main_type,
    l.census_section,
    l.postcode,
    l.municipality_code,
    l.price / nullif(l.surface, 0) as ppm2,
    l.price,
    row_number() over (
      partition by coalesce(l.cluster_id, l.id)
      order by l.last_seen desc,
        (
          (l.title is not null)::int + (l.rooms is not null)::int + (l.floor is not null)::int
          + (l.has_elevator is not null)::int + (l.has_garage is not null)::int
          + (l.is_exterior is not null)::int + (l.condition_hint is not null)::int
          + (l.postcode is not null)::int + (l.bathrooms is not null)::int
          + (l.has_terrace is not null)::int
        ) desc
    ) as rn
  from market_listings l
  where l.surface between 15 and 1500
    and l.price > 0
    and l.last_seen >= (current_date - interval '24 months')
),
base as (
  select
    date_trunc('month', last_seen)::date as month,
    operation,
    main_type,
    census_section,
    postcode,
    municipality_code,
    ppm2,
    price
  from ranked
  where rn = 1
),
levels as (
  select 'census_section'::avm_zone_level as zone_level, census_section as zone_key, month, operation, main_type, ppm2, price from base where census_section is not null
  union all
  select 'postcode'::avm_zone_level, postcode, month, operation, main_type, ppm2, price from base where postcode is not null
  union all
  select 'municipality'::avm_zone_level, municipality_code, month, operation, main_type, ppm2, price from base where municipality_code is not null
)
select
  zone_level,
  zone_key,
  operation,
  main_type,
  month,
  count(*)::int as n,
  percentile_cont(0.5) within group (order by ppm2)::numeric(10,2) as median_ppm2,
  percentile_cont(0.25) within group (order by ppm2)::numeric(10,2) as p25_ppm2,
  percentile_cont(0.75) within group (order by ppm2)::numeric(10,2) as p75_ppm2,
  percentile_cont(0.5) within group (order by price)::numeric(12,0) as median_price
from levels
group by zone_level, zone_key, operation, main_type, month
with no data;

create unique index if not exists market_zone_stats_pk
  on market_zone_stats (zone_level, zone_key, operation, main_type, month);

create or replace view market_zone_trend as
select
  s.zone_level, s.zone_key, s.operation, s.main_type, s.month, s.n, s.median_ppm2, s.p25_ppm2, s.p75_ppm2,
  prev.median_ppm2 as median_ppm2_12m_ago,
  case when prev.median_ppm2 > 0
       then round(((s.median_ppm2 / prev.median_ppm2) - 1) * 100, 1) end as trend_12m_pct
from market_zone_stats s
left join market_zone_stats prev
  on prev.zone_level = s.zone_level and prev.zone_key = s.zone_key
 and prev.operation = s.operation and prev.main_type = s.main_type
 and prev.month = (s.month - interval '12 months')::date;

-- Seis pasadas, separadas 10 minutos, domingo desde las 01:00 UTC (03:00 CEST / 02:00 CET).
create or replace function avm_crawl_dispatch(p_portal text, p_operation text) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
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
    body := jsonb_build_object(
      'municipality_code', '15030',
      'portal', p_portal,
      'operation', p_operation
    ),
    timeout_milliseconds := 300000
  );
end $$;

do $$
declare
  nombre text;
begin
  foreach nombre in array array[
    'avm-market-listings-weekly',
    'avm-crawl-fotocasa-sale',
    'avm-crawl-fotocasa-rent',
    'avm-crawl-habitaclia-sale',
    'avm-crawl-habitaclia-rent',
    'avm-crawl-pisos-sale',
    'avm-crawl-pisos-rent'
  ]
  loop
    if exists (select 1 from cron.job where jobname = nombre) then
      perform cron.unschedule(nombre);
    end if;
  end loop;
end $$;

select cron.schedule('avm-crawl-fotocasa-sale', '0 1 * * 0', $$select avm_crawl_dispatch('fotocasa', 'sale')$$);
select cron.schedule('avm-crawl-fotocasa-rent', '10 1 * * 0', $$select avm_crawl_dispatch('fotocasa', 'rent')$$);
select cron.schedule('avm-crawl-habitaclia-sale', '20 1 * * 0', $$select avm_crawl_dispatch('habitaclia', 'sale')$$);
select cron.schedule('avm-crawl-habitaclia-rent', '30 1 * * 0', $$select avm_crawl_dispatch('habitaclia', 'rent')$$);
select cron.schedule('avm-crawl-pisos-sale', '40 1 * * 0', $$select avm_crawl_dispatch('pisos', 'sale')$$);
select cron.schedule('avm-crawl-pisos-rent', '50 1 * * 0', $$select avm_crawl_dispatch('pisos', 'rent')$$);

create table if not exists postcode_centroids (
  postcode text primary key,
  lat double precision not null,
  lng double precision not null,
  source text not null default 'cartociudad'
);

create table if not exists catastro_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table postcode_centroids enable row level security;
alter table catastro_cache enable row level security;

do $$ begin
  create policy postcode_centroids_read on postcode_centroids for select to authenticated using (true);
exception when duplicate_object then null; end $$;

create or replace function avm_point_zone(p_lat double precision, p_lng double precision)
returns table (census_section text, municipality_code text)
language sql
stable
set search_path = public, extensions
as $$
  select s.code, left(s.code, 5)
  from ine_census_sections s
  where ST_Contains(s.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  limit 1;
$$;

create or replace function avm_catastro_local_at(p_lat double precision, p_lng double precision)
returns table (
  parcel_ref text,
  year_built smallint,
  floors_above_ground smallint,
  area_m2 numeric,
  dwellings int,
  current_use text
)
language sql
stable
set search_path = public, extensions
as $$
  select b.parcel_ref, b.year_built, b.floors_above_ground, b.area_m2, b.dwellings, b.current_use
  from catastro_buildings b
  where b.geom is not null
    and ST_DWithin(b.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 30)
  order by ST_Distance(b.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
  limit 1;
$$;

grant execute on function market_zones_derive() to service_role;
grant execute on function market_listings_recluster() to service_role;
grant execute on function avm_crawl_dispatch(text, text) to service_role;
grant execute on function avm_point_zone(double precision, double precision) to service_role, authenticated;
grant execute on function avm_catastro_local_at(double precision, double precision) to service_role, authenticated;

select market_zones_derive();
select market_listings_recluster();
select market_zone_stats_refresh();
