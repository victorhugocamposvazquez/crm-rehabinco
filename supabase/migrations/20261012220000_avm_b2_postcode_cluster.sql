-- B.2: código postal por polígono (o caché de geocodificación inversa),
-- clúster por precio idéntico y límite de la landing.

-- La capa superficial de códigos postales de CartoCiudad es de Correos y el CNIG
-- solo la sirve para visualización. La tabla queda para ST_Contains cuando haya
-- un fichero descargable. Mientras esté vacía, el CP sale de postcode_reverse_cache.

create table if not exists postcode_polygons (
  postcode text primary key,
  geom geometry(MultiPolygon, 4326) not null
);
create index if not exists postcode_polygons_geom_idx on postcode_polygons using gist (geom);

create table if not exists postcode_reverse_cache (
  lat numeric(8,5) not null,
  lng numeric(8,5) not null,
  postcode text not null,
  geom geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
  ) stored,
  fetched_at timestamptz not null default now(),
  primary key (lat, lng)
);
create index if not exists postcode_reverse_cache_geom_idx on postcode_reverse_cache using gist (geom);

alter table postcode_polygons enable row level security;
alter table postcode_reverse_cache enable row level security;

alter table market_listings add column if not exists portal_postcode text;
update market_listings
set portal_postcode = postcode
where portal_postcode is null and postcode is not null;

create table if not exists avm_rate_limit (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table avm_rate_limit enable row level security;

create unique index if not exists avm_properties_tenant_rc_uidx
  on avm_properties (tenant_id, catastral_ref);

insert into avm_landing_config (tenant_id, slug, active)
values ('00000000-0000-4000-8000-000000000001', 'rehabinco', true)
on conflict (tenant_id) do nothing;

create or replace function avm_postcode_at(p_lat double precision, p_lng double precision)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select s.postcode
  from (
    select p.postcode, 0 as prio, 0::double precision as dist
    from postcode_polygons p
    where ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    union all
    select c.postcode, 1, ST_Distance(c.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
    from postcode_reverse_cache c
    where ST_DWithin(c.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 25)
  ) s
  order by s.prio, s.dist
  limit 1;
$$;

create or replace function market_listings_apply_postcodes() returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n int;
begin
  update market_listings l
  set portal_postcode = coalesce(l.portal_postcode, l.postcode),
      postcode = avm_postcode_at(l.lat, l.lng)
  where l.location_precision = 'exact'
    and l.lat is not null and l.lng is not null
    and avm_postcode_at(l.lat, l.lng) is not null
    and l.postcode is distinct from avm_postcode_at(l.lat, l.lng);
  get diagnostics n = row_count;

  insert into postcode_centroids (postcode, lat, lng, source)
  select p.postcode, ST_Y(ST_PointOnSurface(p.geom)), ST_X(ST_PointOnSurface(p.geom)), 'polygon'
  from postcode_polygons p
  on conflict (postcode) do update
    set lat = excluded.lat, lng = excluded.lng, source = 'polygon';

  return n;
end $$;

create or replace function avm_rate_limit_hit(p_key text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into avm_rate_limit (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update
    set count = avm_rate_limit.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end $$;

create or replace function market_listings_assign_section() returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  seccion text;
  nivel text;
  grupo uuid;
  cp text;
begin
  if new.location_precision = 'exact' and new.lat is not null and new.lng is not null then
    select s.code into seccion
    from ine_census_sections s
    where ST_Contains(s.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326))
    limit 1;
    if seccion is not null then
      new.census_section := seccion;
    end if;
    new.portal_postcode := new.postcode;
    cp := avm_postcode_at(new.lat, new.lng);
    if cp is not null then
      new.postcode := cp;
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
      and l.surface is not null
      and l.price > 0
      and (
        (
          ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography, 40)
          and abs(l.surface - new.surface) <= 3
          and (l.rooms is null or new.rooms is null or l.rooms = new.rooms)
          and abs(l.price - new.price) <= 0.03 * least(l.price, new.price)
        )
        or (
          l.price = new.price
          and ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography, 100)
          and l.surface > 0 and new.surface > 0
          and abs(l.surface - new.surface) <= 0.1 * least(l.surface, new.surface)
        )
      )
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
     and (
       (
         ST_DWithin(a.geom, b.geom, 40)
         and a.surface is not null and b.surface is not null
         and abs(a.surface - b.surface) <= 3
         and (a.rooms is null or b.rooms is null or a.rooms = b.rooms)
         and a.price > 0 and b.price > 0
         and abs(a.price - b.price) <= 0.03 * least(a.price, b.price)
       )
       or (
         a.price = b.price and a.price > 0
         and ST_DWithin(a.geom, b.geom, 100)
         and a.surface is not null and b.surface is not null
         and a.surface > 0 and b.surface > 0
         and abs(a.surface - b.surface) <= 0.1 * least(a.surface, b.surface)
       )
     )
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

drop function if exists avm_comparables(double precision, double precision, avm_main_type, numeric, avm_operation, integer, integer, integer);

create function avm_comparables(
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
  has_terrace     boolean,
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
    where l.active
      and l.operation = p_operation and l.main_type = p_main_type
      and l.surface between p_surface * 0.7 and p_surface * 1.3
      and l.last_seen >= current_date - (p_months || ' months')::interval
      and l.geom is not null
      and ST_DWithin(l.geom, v_point, v_radius);
    exit when v_count >= p_min_n;
  end loop;

  return query
  select u.listing_id, u.portal, u.title, u.price, u.surface, u.price_per_m2,
         u.rooms, u.floor, u.has_elevator, u.has_garage, u.has_terrace, u.is_exterior, u.condition_hint,
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
      l.has_terrace,
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
    where l.active
      and l.operation = p_operation and l.main_type = p_main_type
      and l.surface between p_surface * 0.7 and p_surface * 1.3
      and l.last_seen >= current_date - (p_months || ' months')::interval
      and l.geom is not null
      and ST_DWithin(l.geom, v_point, v_radius)
    order by coalesce(l.cluster_id, l.id), l.last_seen desc, llenos desc
  ) u
  order by u.distance_m
  limit p_max_n;
end $$;

create or replace function avm_zone_median(
  p_lat        double precision,
  p_lng        double precision,
  p_main_type  avm_main_type,
  p_operation  avm_operation default 'sale',
  p_min_n      int default 8
) returns table (
  zone_level  avm_zone_level,
  zone_key    text,
  month       date,
  n           int,
  median_ppm2 numeric,
  p25_ppm2    numeric,
  p75_ppm2    numeric,
  trend_12m_pct numeric
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_section text;
  v_postcode text;
  v_muni text;
begin
  select s.code into v_section
  from ine_census_sections s
  where ST_Contains(s.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  limit 1;

  v_postcode := avm_postcode_at(p_lat, p_lng);
  v_muni := left(v_section, 5);

  if v_muni is null then
    select l.municipality_code into v_muni
    from market_listings l
    where l.geom is not null
    order by l.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    limit 1;
  end if;

  return query
  with candidates as (
    select t.*, 1 as prio from market_zone_trend t
      where t.zone_level = 'census_section' and t.zone_key = v_section
        and t.operation = p_operation and t.main_type = p_main_type
    union all
    select t.*, 2 from market_zone_trend t
      where t.zone_level = 'postcode' and t.zone_key = v_postcode
        and t.operation = p_operation and t.main_type = p_main_type
    union all
    select t.*, 3 from market_zone_trend t
      where t.zone_level = 'municipality' and t.zone_key = v_muni
        and t.operation = p_operation and t.main_type = p_main_type
  ),
  latest as (
    select distinct on (candidates.prio) candidates.*
    from candidates
    where candidates.n >= p_min_n
    order by candidates.prio, candidates.month desc
  )
  select latest.zone_level, latest.zone_key, latest.month, latest.n,
         latest.median_ppm2, latest.p25_ppm2, latest.p75_ppm2, latest.trend_12m_pct
  from latest
  order by latest.prio
  limit 1;
end $$;

grant execute on function avm_postcode_at(double precision, double precision) to service_role, authenticated;
grant execute on function market_listings_apply_postcodes() to service_role;
grant execute on function avm_rate_limit_hit(text, int) to service_role;
grant execute on function avm_comparables(double precision, double precision, avm_main_type, numeric, avm_operation, int, int, int) to service_role, authenticated;
grant execute on function avm_zone_median(double precision, double precision, avm_main_type, avm_operation, int) to service_role, authenticated;
