-- Cargas AVM en CI: scope/rows en avm_jobs y salud por capa.

alter table avm_jobs add column if not exists scope text;
alter table avm_jobs add column if not exists rows int;

create index if not exists avm_jobs_data_finished_idx
  on avm_jobs (job_type, finished_at desc)
  where job_type like 'data:%';

comment on column avm_jobs.scope is 'Alcance: spain, spain/galicia, 15030, all, …';
comment on column avm_jobs.rows is 'Filas insertadas/actualizadas en la carga';

create or replace function avm_data_job_start(p_job text, p_scope text default 'all')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into avm_jobs (job_type, scope, status, payload, started_at)
  values ('data:' || p_job, coalesce(nullif(trim(p_scope), ''), 'all'), 'running', '{}'::jsonb, now())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function avm_data_job_finish(
  p_id uuid,
  p_rows int default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update avm_jobs
  set
    status = case when p_error is null then 'done' else 'failed' end,
    rows = p_rows,
    error = p_error,
    finished_at = now(),
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function avm_data_job_start(text, text) to service_role;
grant execute on function avm_data_job_finish(uuid, int, text) to service_role;

-- Última carga conocida por capa (jobs CI + tablas).
create or replace function avm_data_job_last(p_layer text)
returns timestamptz
language sql
stable
as $$
  select max(finished_at)
  from avm_jobs
  where job_type = 'data:' || p_layer and status = 'done';
$$;

create or replace function avm_upsert_ine_sections_batch(p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  n int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into ine_census_sections (code, geom)
    values (
      r->>'code',
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(r->'geom'), 4326))::geometry(MultiPolygon, 4326)
    )
    on conflict (code) do update set geom = excluded.geom;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function avm_upsert_ine_sections_batch(jsonb) to service_role;

create or replace function avm_municipality_bbox(p_muni text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'minLng', ST_XMin(e),
    'minLat', ST_YMin(e),
    'maxLng', ST_XMax(e),
    'maxLat', ST_YMax(e)
  )
  from (
    select ST_Extent(geom)::geometry as e
    from ine_census_sections
    where code like p_muni || '%'
  ) t
  where e is not null;
$$;

grant execute on function avm_municipality_bbox(text) to service_role;

create or replace function avm_upsert_catastro_buildings_batch(p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  n int := 0;
begin
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into catastro_buildings (
      municipality_code, parcel_ref, building_ref, year_built, current_use,
      dwellings, building_units, floors_above_ground, area_m2, condition, geom, loaded_at
    )
    values (
      r->>'municipality_code',
      r->>'parcel_ref',
      nullif(r->>'building_ref', ''),
      nullif(r->>'year_built', '')::smallint,
      nullif(r->>'current_use', ''),
      nullif(r->>'dwellings', '')::int,
      nullif(r->>'building_units', '')::int,
      nullif(r->>'floors_above_ground', '')::smallint,
      nullif(r->>'area_m2', '')::numeric,
      nullif(r->>'condition', ''),
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(r->'geom'), 4326))::geography,
      coalesce((r->>'loaded_at')::timestamptz, now())
    )
    on conflict (municipality_code, parcel_ref, building_ref) do update set
      year_built = excluded.year_built,
      current_use = excluded.current_use,
      dwellings = excluded.dwellings,
      building_units = excluded.building_units,
      floors_above_ground = excluded.floors_above_ground,
      area_m2 = excluded.area_m2,
      condition = excluded.condition,
      geom = excluded.geom,
      loaded_at = excluded.loaded_at;
    n := n + 1;
  end loop;
  return n;
end;
$$;

grant execute on function avm_upsert_catastro_buildings_batch(jsonb) to service_role;

create or replace function avm_data_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_agg(row order by row->>'layer')
  from (
    select jsonb_build_object(
      'layer', 'osm',
      'loaded_at', coalesce((select max(loaded_at) from environment_layers where source = 'OSM'), avm_data_job_last('osm'))
    ) as row
    union all
    select jsonb_build_object(
      'layer', 'gtfs',
      'loaded_at', coalesce((select max(loaded_at) from environment_layers where source = 'GTFS'), avm_data_job_last('gtfs'))
    )
    union all
    select jsonb_build_object(
      'layer', 'crime',
      'loaded_at', coalesce((select max(loaded_at) from crime_stats), avm_data_job_last('crime'))
    )
    union all
    select jsonb_build_object(
      'layer', 'vulnerability',
      'loaded_at', coalesce((select max(loaded_at) from vulnerability_sections), avm_data_job_last('vulnerability'))
    )
    union all
    select jsonb_build_object(
      'layer', 'snczi',
      'loaded_at', coalesce(
        (select max(loaded_at) from environment_layers where source ilike 'SNCZI%'),
        avm_data_job_last('snczi')
      )
    )
    union all
    select jsonb_build_object(
      'layer', 'noise',
      'loaded_at', coalesce(
        (select max(loaded_at) from environment_layers where source ilike 'Mapa estratégico%'),
        avm_data_job_last('noise')
      )
    )
    union all
    select jsonb_build_object(
      'layer', 'ine_sections',
      'loaded_at', coalesce(
        (select max(finished_at) from avm_jobs where job_type = 'data:ine_sections' and status = 'done'),
        avm_data_job_last('ine_sections')
      )
    )
    union all
    select jsonb_build_object(
      'layer', 'inspire',
      'loaded_at', coalesce((select max(loaded_at) from catastro_buildings), avm_data_job_last('inspire'))
    )
  ) t;
$$;

grant execute on function avm_data_health() to authenticated, service_role;
