-- Cobertura de capas de entorno por punto (informe: sin cargar vs sin elementos a 600 m)

create or replace function avm_environment_coverage(
  p_lat double precision,
  p_lng double precision,
  p_municipality_code text default null
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
  v_layers jsonb;
begin
  select count(*)::int into v_geo_layers
  from environment_layers e
  where ST_DWithin(e.geom, v_point, 8000);

  select exists (
    select 1 from crime_stats c
    where p_municipality_code is not null and c.municipality_code = p_municipality_code
    limit 1
  ) into v_has_crime;

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
    select
      'crime_municipality'::text as layer,
      'Ministerio del Interior'::text as source,
      max(c.loaded_at) as loaded_at
    from crime_stats c
    where p_municipality_code is not null and c.municipality_code = p_municipality_code
  ),
  merged as (
    select * from near
    union all
    select layer, source, loaded_at from crime_row where loaded_at is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('layer', layer, 'source', source, 'loaded_at', loaded_at)
      order by layer, source
    ),
    '[]'::jsonb
  )
  into v_layers
  from merged;

  return jsonb_build_object(
    'municipality_has_layers', (v_geo_layers > 0 or v_has_crime),
    'elements_within_600m', v_within_600,
    'layers_consulted', coalesce(v_layers, '[]'::jsonb)
  );
end $$;

grant execute on function avm_environment_coverage(double precision, double precision, text)
  to service_role, authenticated;
