-- Segunda vuelta de clúster, defensa de comparables, columnas del informe y estadísticas del método.

alter table avm_valuations add column if not exists range_method text;
alter table avm_valuations add column if not exists rent_source text;

create table if not exists avm_method_stats_cache (
  tenant_id uuid primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table avm_method_stats_cache enable row level security;

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
        or (
          l.price = new.price
          and ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography, 300)
          and l.surface > 0 and new.surface > 0
          and abs(l.surface - new.surface) <= 0.05 * least(l.surface, new.surface)
        )
        or (
          l.price = new.price
          and ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography, 100)
          and l.surface > 0 and new.surface > 0
          and abs(l.surface - new.surface) <= 0.15 * least(l.surface, new.surface)
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
       or (
         a.price = b.price and a.price > 0
         and ST_DWithin(a.geom, b.geom, 300)
         and a.surface is not null and b.surface is not null
         and a.surface > 0 and b.surface > 0
         and abs(a.surface - b.surface) <= 0.05 * least(a.surface, b.surface)
       )
       or (
         a.price = b.price and a.price > 0
         and ST_DWithin(a.geom, b.geom, 100)
         and a.surface is not null and b.surface is not null
         and a.surface > 0 and b.surface > 0
         and abs(a.surface - b.surface) <= 0.15 * least(a.surface, b.surface)
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

create or replace function avm_comparables(
  p_lat        double precision,
  p_lng        double precision,
  p_main_type  avm_main_type,
  p_surface    numeric,
  p_operation  avm_operation default 'sale',
  p_min_n      int default 8,
  p_max_n      int default 40,
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
  with base as (
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
  )
  select b.listing_id, b.portal, b.title, b.price, b.surface, b.price_per_m2,
         b.rooms, b.floor, b.has_elevator, b.has_garage, b.has_terrace, b.is_exterior, b.condition_hint,
         b.last_seen, b.distance_m, v_radius
  from base b
  where not exists (
    select 1 from base c
    where c.price = b.price
      and c.surface > 0 and b.surface > 0
      and abs(c.surface - b.surface) <= 0.05 * least(c.surface, b.surface)
      and (
        c.distance_m < b.distance_m
        or (c.distance_m = b.distance_m and c.listing_id < b.listing_id)
      )
  )
  order by b.distance_m
  limit p_max_n;
end $$;

create or replace function avm_method_stats(p_empty boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  tid uuid := avm_current_tenant();
  cached jsonb;
  fetched timestamptz;
  result jsonb;
  v_listings jsonb;
  v_munis jsonb;
  v_months int;
  v_zones int;
  v_sections int;
  v_polygons int;
  v_inspire int;
  v_cache int;
  v_vals int;
  v_bands jsonb;
  v_layers jsonb;
  v_closes int;
  v_error numeric;
begin
  if p_empty then
    return jsonb_build_object(
      'listings', '[]'::jsonb,
      'municipalities', '[]'::jsonb,
      'historyMonths', 0,
      'zonesWithMedian', 0,
      'censusSections', 0,
      'postcodePolygons', 0,
      'inspireMunicipalities', 0,
      'catastroCache', 0,
      'valuations', 0,
      'confidenceBands', jsonb_build_object('baja', 0, 'media', 0, 'alta', 0),
      'layers', '{}'::jsonb,
      'closes', 0,
      'medianAbsError', null
    );
  end if;

  if tid is not null then
    select payload, fetched_at into cached, fetched
    from avm_method_stats_cache where tenant_id = tid;
    if found and fetched > now() - interval '1 hour' then
      return cached;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'portal', portal, 'operation', operation, 'active', active, 'clusters', clusters
  )), '[]'::jsonb) into v_listings
  from (
    select portal, operation::text as operation,
           count(*) filter (where active)::int as active,
           count(distinct cluster_id) filter (where active)::int as clusters
    from market_listings
    group by portal, operation
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object(
    'portal', portal, 'municipalities', municipalities, 'lastRun', last_run
  )), '[]'::jsonb) into v_munis
  from (
    select portal,
           count(distinct municipality_code)::int as municipalities,
           max(finished_at) as last_run
    from market_crawl_runs
    group by portal
  ) s;

  select count(distinct month)::int into v_months from market_zone_trend;
  select count(*)::int into v_zones from (
    select zone_level, zone_key, operation, main_type
    from market_zone_trend
    where median_ppm2 is not null
    group by zone_level, zone_key, operation, main_type
  ) z;
  select count(*)::int into v_sections from ine_census_sections;
  select count(*)::int into v_polygons from postcode_polygons;
  select count(distinct municipality_code)::int into v_inspire from catastro_buildings;
  select count(*)::int into v_cache from catastro_cache;

  select count(*)::int into v_vals from avm_valuations where tenant_id = tid;
  select jsonb_build_object(
    'baja', count(*) filter (where confidence < 50),
    'media', count(*) filter (where confidence >= 50 and confidence < 75),
    'alta', count(*) filter (where confidence >= 75)
  ) into v_bands
  from avm_valuations where tenant_id = tid;

  select coalesce(jsonb_object_agg(layer, statuses), '{}'::jsonb) into v_layers
  from (
    select layer, jsonb_object_agg(status, pct) as statuses
    from (
      select elem->>'layer' as layer,
             elem->>'status' as status,
             round(100.0 * count(*) / nullif(sum(count(*)) over (partition by elem->>'layer'), 0), 1) as pct
      from avm_valuations v
      cross join lateral jsonb_array_elements(coalesce(v.sources_used, '[]'::jsonb)) elem
      where v.tenant_id = tid
      group by elem->>'layer', elem->>'status'
    ) p
    group by layer
  ) g;

  select count(*)::int into v_closes from market_discount;
  v_error := null;

  result := jsonb_build_object(
    'listings', coalesce(v_listings, '[]'::jsonb),
    'municipalities', coalesce(v_munis, '[]'::jsonb),
    'historyMonths', coalesce(v_months, 0),
    'zonesWithMedian', coalesce(v_zones, 0),
    'censusSections', coalesce(v_sections, 0),
    'postcodePolygons', coalesce(v_polygons, 0),
    'inspireMunicipalities', coalesce(v_inspire, 0),
    'catastroCache', coalesce(v_cache, 0),
    'valuations', coalesce(v_vals, 0),
    'confidenceBands', coalesce(v_bands, jsonb_build_object('baja', 0, 'media', 0, 'alta', 0)),
    'layers', coalesce(v_layers, '{}'::jsonb),
    'closes', coalesce(v_closes, 0),
    'medianAbsError', case when coalesce(v_closes, 0) >= 20 then v_error else null end
  );

  if tid is not null then
    insert into avm_method_stats_cache (tenant_id, payload, fetched_at)
    values (tid, result, now())
    on conflict (tenant_id) do update
      set payload = excluded.payload, fetched_at = excluded.fetched_at;
  end if;
  return result;
end $$;

grant execute on function avm_comparables(double precision, double precision, avm_main_type, numeric, avm_operation, int, int, int) to service_role, authenticated;
grant execute on function avm_method_stats(boolean) to service_role, authenticated;
grant execute on function market_listings_recluster() to service_role;
