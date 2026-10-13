-- Tasa de criminalidad acotada, sección censal con edición y pie de capas.

alter table crime_stats add column if not exists peer_band text;
alter table crime_stats add column if not exists population integer;
alter table crime_stats add column if not exists offenses integer;

alter table vulnerability_sections add column if not exists geom geography;

update vulnerability_sections v
set geom = s.geom::geography
from ine_census_sections s
where v.geom is null and s.code = v.census_section;

create table if not exists avm_alerts (
  id bigint generated always as identity primary key,
  kind text not null,
  layer text,
  municipality_code text,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table avm_alerts enable row level security;
do $$ begin
  create policy avm_alerts_read on avm_alerts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
grant select on avm_alerts to authenticated, service_role;
grant insert on avm_alerts to service_role;

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
  v_section text;
begin
  select s.code into v_section
  from ine_census_sections s
  where ST_Contains(s.geom, v_point::geometry)
  limit 1;
  v_section := coalesce(nullif(p_census_section, ''), v_section);

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
      e.layer, e.category, e.sense, e.name, e.props,
      round(ST_Distance(e.geom, v_point)::numeric, 0) as distance_m
    from environment_layers e
    where e.layer not in ('flood', 'vulnerable_section', 'crime_municipality')
      and ST_DWithin(e.geom, v_point, 2000)
    order by e.layer, coalesce(e.category, ''), ST_Distance(e.geom, v_point)
  ),
  flood_hit as (
    select e.layer, e.category, e.sense, e.name, e.props, 0::numeric as distance_m
    from environment_layers e
    where e.layer = 'flood' and ST_Contains(e.geom::geometry, v_point::geometry)
    order by case e.props->>'period' when 'T10' then 1 when 'T100' then 2 when 'T500' then 3 else 4 end
    limit 1
  ),
  flood_clear as (
    select 'flood'::text, 'fuera'::text, 'info'::text, null::text,
      jsonb_build_object('clear', true, 'period', 'fuera'), 0::numeric
    where not exists (select 1 from flood_hit)
      and exists (
        select 1 from environment_layers e
        where e.layer = 'flood' and ST_DWithin(e.geom, v_point, 30000)
      )
  ),
  vuln_code as (
    select v.census_section, v.edition, v.indicator
    from vulnerability_sections v
    where v_section is not null and v.census_section = v_section
      and v.indicator is not null and v.indicator <> 'NV' and v.indicator not like 'NV%'
    order by v.loaded_at desc
    limit 1
  ),
  vuln_geom as (
    select v.census_section, v.edition, v.indicator
    from ine_census_sections s
    join vulnerability_sections v
      on v.geom is not null
     and ST_Contains(v.geom::geometry, ST_Centroid(s.geom))
     and v.indicator is not null and v.indicator <> 'NV' and v.indicator not like 'NV%'
    where v_section is not null and s.code = v_section
      and not exists (select 1 from vulnerability_sections x where x.census_section = v_section)
    order by v.loaded_at desc
    limit 1
  ),
  vuln as (
    select
      'vulnerable_section'::text as layer,
      null::text as category,
      'negative'::text as sense,
      null::text as name,
      jsonb_build_object('edition', u.edition, 'indicator', u.indicator, 'census_section', coalesce(v_section, u.census_section)) as props,
      0::numeric as distance_m
    from (
      select * from vuln_code
      union all
      select * from vuln_geom
    ) u
    limit 1
  ),
  vuln_meta as (
    select v.edition
    from vulnerability_sections v
    where v_section is not null and v.census_section = v_section
    order by v.loaded_at desc
    limit 1
  ),
  vuln_clear as (
    select
      'vulnerable_section'::text,
      null::text,
      'info'::text,
      null::text,
      jsonb_build_object('clear', true, 'census_section', v_section, 'edition', (select edition from vuln_meta)),
      0::numeric
    where v_section is not null
      and not exists (select 1 from vuln)
      and (exists (select 1 from vuln_meta) or exists (select 1 from vulnerability_sections limit 1))
  ),
  crime as (
    select
      'crime_municipality'::text,
      null::text,
      'info'::text,
      null::text,
      jsonb_build_object(
        'rate_per_1000', c.rate_per_1000,
        'peer_avg', c.peer_avg,
        'peer_band', c.peer_band,
        'period', c.period,
        'population', c.population
      ),
      0::numeric
    from crime_stats c
    where p_municipality_code is not null
      and c.municipality_code = p_municipality_code
      and c.rate_per_1000 >= 0 and c.rate_per_1000 <= 200
    order by c.period desc
    limit 1
  ),
  merged as (
    select * from base_nearest
    union all select * from flood_hit
    union all select * from flood_clear
    union all select * from vuln
    union all select * from vuln_clear
    union all select * from crime
  )
  select coalesce(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb) into v_nearest from merged m;

  select coalesce(jsonb_object_agg(c.category, c.n_500m), '{}'::jsonb) into v_counts
  from (
    select e.category, count(*)::int as n_500m
    from environment_layers e
    where e.layer = 'osm_poi'
      and e.category in ('shop', 'restaurant', 'nightlife', 'gym', 'supermarket', 'pharmacy')
      and ST_DWithin(e.geom, v_point, 500)
    group by e.category
  ) c;

  return jsonb_build_object(
    'nearest', coalesce(v_nearest, '[]'::jsonb),
    'counts_500m', coalesce(v_counts, '{}'::jsonb),
    'meta', jsonb_build_object('has_osm', v_has_osm, 'osm_loaded_at', v_osm_loaded, 'census_section', v_section)
  );
end $$;

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
      'n', count(*)::int,
      'loaded_at', max(loaded_at)
    ) as row
    from environment_layers
    group by layer, source
    union all
    select jsonb_build_object(
      'layer', 'crime_municipality',
      'source', 'Ministerio del Interior',
      'n', count(*)::int,
      'loaded_at', max(loaded_at)
    )
    from crime_stats
    having count(*) > 0
    union all
    select jsonb_build_object(
      'layer', 'vulnerable_section',
      'source', 'Observatorio de la Vulnerabilidad Urbana',
      'n', count(*) filter (where indicator is not null and indicator <> 'NV' and indicator not like 'NV%')::int,
      'loaded_at', max(loaded_at)
    )
    from vulnerability_sections
    having count(*) > 0
  ) s;
$$;

create or replace function avm_environment_coverage(
  p_lat double precision,
  p_lng double precision,
  p_municipality_code text default null,
  p_census_section text default null
) returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_geo_layers int;
  v_within_600 int;
  v_has_crime boolean;
  v_has_vuln boolean;
  v_layers jsonb;
  v_loaded jsonb;
begin
  select count(*)::int into v_geo_layers
  from environment_layers e
  where ST_DWithin(e.geom, v_point, 8000);

  select exists (
    select 1 from crime_stats c
    where p_municipality_code is not null and c.municipality_code = p_municipality_code
      and c.rate_per_1000 >= 0 and c.rate_per_1000 <= 200
    limit 1
  ) into v_has_crime;

  select exists (
    select 1 from vulnerability_sections v
    where p_census_section is not null and v.census_section = p_census_section
    limit 1
  ) into v_has_vuln;

  select count(*)::int into v_within_600
  from environment_layers e
  where e.layer not in ('flood', 'vulnerable_section', 'crime_municipality')
    and ST_DWithin(e.geom, v_point, 600);

  with near as (
    select e.layer, coalesce(e.source, 'unknown') as source, max(e.loaded_at) as loaded_at
    from environment_layers e
    where ST_DWithin(e.geom, v_point, 1500)
    group by e.layer, coalesce(e.source, 'unknown')
  ),
  crime_row as (
    select 'crime_municipality'::text as layer, 'Ministerio del Interior'::text as source, max(c.loaded_at) as loaded_at
    from crime_stats c
    where p_municipality_code is not null and c.municipality_code = p_municipality_code
  ),
  vuln_row as (
    select 'vulnerable_section'::text as layer, 'Observatorio de la Vulnerabilidad Urbana'::text as source, max(v.loaded_at) as loaded_at
    from vulnerability_sections v
    where p_census_section is not null and v.census_section = p_census_section
  ),
  merged as (
    select * from near
    union all select layer, source, loaded_at from crime_row where loaded_at is not null
    union all select layer, source, loaded_at from vuln_row where loaded_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object('layer', layer, 'source', source, 'loaded_at', loaded_at) order by layer, source), '[]'::jsonb)
  into v_layers from merged;

  v_loaded := avm_environment_layer_stats();

  return jsonb_build_object(
    'municipality_has_layers', (v_geo_layers > 0 or v_has_crime or v_has_vuln),
    'municipal_stats_loaded', (v_has_crime or v_has_vuln),
    'elements_within_600m', v_within_600,
    'layers_consulted', coalesce(v_layers, '[]'::jsonb),
    'layers_loaded', coalesce(v_loaded, '[]'::jsonb)
  );
end $$;

delete from avm_method_stats_cache;
