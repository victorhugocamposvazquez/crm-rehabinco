-- Sin OSM cargado aún devolver inundación, vulnerabilidad y criminalidad (no vaciar nearest).

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
      'nearest', coalesce(v_nearest, '[]'::jsonb),
      'counts_500m', coalesce(v_counts, '{}'::jsonb),
      'meta', jsonb_build_object('has_osm', false, 'osm_loaded_at', null)
    );
  end if;

  return jsonb_build_object(
    'nearest', coalesce(v_nearest, '[]'::jsonb),
    'counts_500m', coalesce(v_counts, '{}'::jsonb),
    'meta', jsonb_build_object('has_osm', true, 'osm_loaded_at', v_osm_loaded)
  );
end $$;
