-- Fase G · Entorno: tablas auxiliares, avm_environment ampliado, stats de capas

create table if not exists vulnerability_sections (
  census_section text not null,
  edition        text not null,
  indicator      text,
  loaded_at      timestamptz not null default now(),
  primary key (census_section, edition)
);
create index if not exists vulnerability_sections_section_idx on vulnerability_sections (census_section);

create table if not exists crime_stats (
  municipality_code text not null,
  period            text not null,
  rate_per_1000     numeric not null,
  peer_avg          numeric,
  loaded_at         timestamptz not null default now(),
  primary key (municipality_code, period)
);

alter table vulnerability_sections enable row level security;
alter table crime_stats enable row level security;

do $$ begin
  create policy vulnerability_sections_read on vulnerability_sections for select to authenticated using (true);
  create policy crime_stats_read on crime_stats for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Carga con service_role (scripts env-load)
grant select on vulnerability_sections to authenticated, service_role;
grant select on crime_stats to authenticated, service_role;
grant all on vulnerability_sections to service_role;
grant all on crime_stats to service_role;

create or replace function avm_environment(
  p_lat double precision,
  p_lng double precision,
  p_census_section text default null,
  p_municipality_code text default null
) returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_has_osm boolean;
  v_osm_loaded timestamptz;
  v_nearest jsonb;
  v_counts jsonb;
  v_crime_period text;
begin
  select exists (
    select 1 from environment_layers e
    where e.source = 'OSM' and e.layer in ('osm_poi', 'school', 'health')
      and ST_DWithin(e.geom, v_point, 8000)
    limit 1
  ) into v_has_osm;

  select max(loaded_at) into v_osm_loaded
  from environment_layers e
  where e.source = 'OSM' and ST_DWithin(e.geom, v_point, 8000);

  with base_nearest as (
    select distinct on (e.layer, coalesce(e.category, ''))
      e.layer,
      e.category,
      e.sense,
      e.name,
      e.props,
      round(ST_Distance(e.geom, v_point)::numeric, 0) as distance_m
    from environment_layers e
    where e.layer not in ('flood', 'vulnerable_section', 'crime_municipality')
      and ST_DWithin(e.geom, v_point, 1500)
    order by e.layer, coalesce(e.category, ''), ST_Distance(e.geom, v_point)
  ),
  flood_hit as (
    select e.layer, e.category, e.sense, e.name, e.props, 0::numeric as distance_m
    from environment_layers e
    where e.layer = 'flood'
      and ST_Contains(e.geom::geometry, v_point::geometry)
    order by case e.props->>'period' when 'T10' then 1 when 'T100' then 2 when 'T500' then 3 else 4 end
    limit 1
  ),
  vuln as (
    select
      'vulnerable_section'::text as layer,
      null::text as category,
      'negative'::text as sense,
      null::text as name,
      jsonb_build_object('edition', v.edition, 'indicator', v.indicator) as props,
      0::numeric as distance_m
    from vulnerability_sections v
    where p_census_section is not null and v.census_section = p_census_section
    order by v.loaded_at desc
    limit 1
  ),
  crime as (
    select
      'crime_municipality'::text as layer,
      null::text as category,
      'info'::text as sense,
      null::text as name,
      jsonb_build_object(
        'rate_per_1000', c.rate_per_1000,
        'peer_avg', c.peer_avg,
        'period', c.period
      ) as props,
      0::numeric as distance_m
    from crime_stats c
    where p_municipality_code is not null and c.municipality_code = p_municipality_code
    order by c.period desc
    limit 1
  ),
  merged as (
    select * from base_nearest
    union all
    select * from flood_hit
    union all
    select * from vuln
    union all
    select * from crime
  )
  select coalesce(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb)
  into v_nearest
  from merged m;

  select coalesce(jsonb_object_agg(c.category, c.n_500m), '{}'::jsonb)
  into v_counts
  from (
    select e.category, count(*)::int as n_500m
    from environment_layers e
    where e.layer = 'osm_poi'
      and e.category in ('shop', 'restaurant', 'nightlife', 'gym', 'supermarket', 'pharmacy')
      and ST_DWithin(e.geom, v_point, 500)
    group by e.category
  ) c;

  if not v_has_osm then
    return jsonb_build_object(
      'nearest', '[]'::jsonb,
      'counts_500m', '{}'::jsonb,
      'meta', jsonb_build_object('has_osm', false, 'osm_loaded_at', null)
    );
  end if;

  return jsonb_build_object(
    'nearest', coalesce(v_nearest, '[]'::jsonb),
    'counts_500m', coalesce(v_counts, '{}'::jsonb),
    'meta', jsonb_build_object('has_osm', true, 'osm_loaded_at', v_osm_loaded)
  );
end $$;

grant execute on function avm_environment(double precision, double precision, text, text)
  to service_role, authenticated;

-- Resumen de capas cargadas (metodología)
create or replace function avm_environment_layer_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(row order by (row->>'layer'), (row->>'source')), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'layer', layer,
      'source', coalesce(source, 'unknown'),
      'category', category,
      'n', count(*)::int,
      'loaded_at', max(loaded_at)
    ) as row
    from environment_layers
    group by layer, source, category
  ) s;
$$;

grant execute on function avm_environment_layer_stats() to service_role, authenticated;

-- Inserción masiva desde scripts (WKT en campo geom)
create or replace function env_insert_layers(p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  n int := 0;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    return 0;
  end if;
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into environment_layers (layer, category, name, sense, props, geom, source, loaded_at)
    values (
      r->>'layer',
      nullif(r->>'category', ''),
      nullif(r->>'name', ''),
      nullif(r->>'sense', ''),
      coalesce(r->'props', '{}'::jsonb),
      ST_GeogFromText(r->>'geom')::geography,
      r->>'source',
      coalesce((r->>'loaded_at')::timestamptz, now())
    );
    n := n + 1;
  end loop;
  return n;
end $$;

grant execute on function env_insert_layers(jsonb) to service_role;

-- Incluir capas de entorno en avm_method_stats
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
  v_env_layers jsonb;
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
      'environmentLayers', '[]'::jsonb,
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

  v_env_layers := avm_environment_layer_stats();
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
    'environmentLayers', coalesce(v_env_layers, '[]'::jsonb),
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
