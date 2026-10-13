-- Conteos de env-1.1: comercios a 500 m, hostelería a 300 m, pubs a 100 m,
-- y el ruido del punto (el Lden más alto), no el de una vía lejana.

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
  v_counts_300 jsonb;
  v_counts_100 jsonb;
  v_section text;
begin
  select s.code into v_section
  from ine_census_sections s
  where ST_Contains(s.geom, v_point::geometry)
  limit 1;
  v_section := coalesce(nullif(p_census_section, ''), v_section);

  select exists (
    select 1 from environment_layers e
    where e.source = 'OSM' and e.layer in ('osm_poi', 'school', 'health', 'gtfs_stop')
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
    where e.layer not in ('flood', 'vulnerable_section', 'crime_municipality', 'noise')
      and ST_DWithin(e.geom, v_point, 2000)
    order by e.layer, coalesce(e.category, ''), ST_Distance(e.geom, v_point)
  ),
  noise_hit as (
    select e.layer, e.category, e.sense, e.name, e.props,
      round(ST_Distance(e.geom, v_point)::numeric, 0) as distance_m
    from environment_layers e
    where e.layer = 'noise' and ST_DWithin(e.geom, v_point, 80)
    order by coalesce(nullif(e.props->>'lden', '')::numeric, 0) desc
    limit 1
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
    union all select * from noise_hit
    union all select * from flood_hit
    union all select * from flood_clear
    union all select * from vuln
    union all select * from vuln_clear
    union all select * from crime
  )
  select coalesce(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb) into v_nearest from merged m;

  select coalesce(jsonb_object_agg(c.category, c.n), '{}'::jsonb) into v_counts
  from (
    select e.category,
      count(distinct (
        round(ST_Y(ST_Centroid(e.geom::geometry))::numeric, 4)::text
        || '|' ||
        round(ST_X(ST_Centroid(e.geom::geometry))::numeric, 4)::text
      ))::int as n
    from environment_layers e
    where e.category is not null
      and e.layer in ('osm_poi', 'school', 'health', 'gtfs_stop')
      and ST_DWithin(e.geom, v_point, 500)
    group by e.category
  ) c;

  select coalesce(jsonb_object_agg(c.category, c.n), '{}'::jsonb) into v_counts_300
  from (
    select e.category,
      count(distinct (
        round(ST_Y(ST_Centroid(e.geom::geometry))::numeric, 4)::text
        || '|' ||
        round(ST_X(ST_Centroid(e.geom::geometry))::numeric, 4)::text
      ))::int as n
    from environment_layers e
    where e.category = 'hospitality' and ST_DWithin(e.geom, v_point, 300)
    group by e.category
  ) c;

  select coalesce(jsonb_object_agg(c.category, c.n), '{}'::jsonb) into v_counts_100
  from (
    select e.category,
      count(distinct (
        round(ST_Y(ST_Centroid(e.geom::geometry))::numeric, 4)::text
        || '|' ||
        round(ST_X(ST_Centroid(e.geom::geometry))::numeric, 4)::text
      ))::int as n
    from environment_layers e
    where e.category = 'nightlife' and ST_DWithin(e.geom, v_point, 100)
    group by e.category
  ) c;

  return jsonb_build_object(
    'nearest', coalesce(v_nearest, '[]'::jsonb),
    'counts_500m', coalesce(v_counts, '{}'::jsonb),
    'counts_300m', coalesce(v_counts_300, '{}'::jsonb),
    'counts_100m', coalesce(v_counts_100, '{}'::jsonb),
    'meta', jsonb_build_object('has_osm', v_has_osm, 'osm_loaded_at', v_osm_loaded, 'census_section', v_section)
  );
end $$;
