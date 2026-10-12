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

/** Última carga conocida por capa (jobs CI + tablas). */
create or replace function avm_data_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with jobs as (
    select
      replace(job_type, 'data:', '') as layer,
      max(finished_at) filter (where status = 'done') as job_at,
      max(rows) filter (where status = 'done' and finished_at = (
        select max(j2.finished_at) from avm_jobs j2
        where j2.job_type = avm_jobs.job_type and j2.status = 'done'
      )) as job_rows,
      (array_agg(error order by finished_at desc) filter (where status = 'failed'))[1] as last_error
    from avm_jobs
    where job_type like 'data:%'
    group by job_type
  )
  select jsonb_agg(row order by row->>'layer')
  from (
    select jsonb_build_object(
      'layer', 'osm',
      'loaded_at', coalesce((select max(loaded_at) from environment_layers where source = 'OSM'), (select job_at from jobs where layer = 'osm')),
      'source', 'environment_layers|avm_jobs'
    ) as row
    union all
    select jsonb_build_object(
      'layer', 'gtfs',
      'loaded_at', coalesce((select max(loaded_at) from environment_layers where source = 'GTFS'), (select job_at from jobs where layer = 'gtfs')),
      'source', 'environment_layers|avm_jobs'
    )
    union all
    select jsonb_build_object('layer', 'crime', 'loaded_at', coalesce((select max(loaded_at) from crime_stats), (select job_at from jobs where layer = 'crime')), 'source', 'crime_stats|avm_jobs')
    union all
    select jsonb_build_object('layer', 'vulnerability', 'loaded_at', coalesce((select max(loaded_at) from vulnerability_sections), (select job_at from jobs where layer = 'vulnerability')), 'source', 'vulnerability_sections|avm_jobs')
    union all
    select jsonb_build_object('layer', 'snczi', 'loaded_at', coalesce((select max(loaded_at) from environment_layers where source like 'SNCZI%'), (select job_at from jobs where layer = 'snczi')), 'source', 'environment_layers|avm_jobs')
    union all
    select jsonb_build_object('layer', 'noise', 'loaded_at', coalesce((select max(loaded_at) from environment_layers where source = 'Mapa estratégico%'), (select job_at from jobs where layer = 'noise')), 'source', 'environment_layers|avm_jobs')
    union all
    select jsonb_build_object('layer', 'ine_sections', 'loaded_at', coalesce((select max(loaded_at) from avm_jobs where job_type = 'data:ine_sections' and status = 'done'), null), 'source', 'avm_jobs')
    union all
    select jsonb_build_object('layer', 'inspire', 'loaded_at', coalesce((select max(loaded_at) from catastro_buildings), (select job_at from jobs where layer = 'inspire')), 'source', 'catastro_buildings|avm_jobs')
  ) t;
$$;

grant execute on function avm_data_health() to authenticated, service_role;
