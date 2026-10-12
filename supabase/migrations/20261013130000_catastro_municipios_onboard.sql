-- Catastro nacional: municipios Sede × INE, vías CartoCiudad, onboarding mercado (fase F).

create table if not exists catastro_municipios (
  ine_code        text primary key check (ine_code ~ '^\d{5}$'),
  province_code   text not null check (province_code ~ '^\d{2}$'),
  province_name   text not null,
  name_catastro   text not null,
  name_ine        text,
  is_foral        boolean not null default false,
  catastro_cmc    text,
  loaded_at       timestamptz not null default now()
);

create index if not exists catastro_municipios_prov_idx on catastro_municipios (province_code);
create index if not exists catastro_municipios_name_catastro_idx on catastro_municipios (name_catastro);

create table if not exists carto_tipos_via (
  carto_label     text primary key,
  catastro_sigla  text not null check (char_length(catastro_sigla) = 2)
);

create table if not exists portal_municipalities (
  portal          text not null,
  ine_code        text not null check (ine_code ~ '^\d{5}$'),
  slug            text,
  url_base        text,
  status          text not null default 'pending'
    check (status in ('pending', 'resolved', 'manual', 'failed')),
  resolved_at     timestamptz,
  notes           text,
  primary key (portal, ine_code)
);

create table if not exists avm_jobs (
  id              uuid primary key default gen_random_uuid(),
  job_type        text not null,
  ine_code        text,
  status          text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  payload         jsonb not null default '{}'::jsonb,
  log             jsonb not null default '[]'::jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

create index if not exists avm_jobs_pending_idx on avm_jobs (status, job_type, created_at)
  where status in ('pending', 'running');

alter table catastro_municipios enable row level security;
alter table carto_tipos_via enable row level security;
alter table portal_municipalities enable row level security;
alter table avm_jobs enable row level security;

do $$ begin
  create policy catastro_municipios_read on catastro_municipios for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy carto_tipos_via_read on carto_tipos_via for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy portal_municipalities_read on portal_municipalities for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Solo service role escribe catálogos y jobs (sin policy insert para authenticated).

create or replace function avm_job_log(p_job_id uuid, p_line text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update avm_jobs
  set
    log = log || jsonb_build_array(jsonb_build_object('at', now(), 'msg', p_line, 'data', p_data)),
    updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function municipality_onboard_enqueue(p_ine_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text := lpad(regexp_replace(coalesce(p_ine_code, ''), '\D', '', 'g'), 5, '0');
begin
  if v_code !~ '^\d{5}$' then
    raise exception 'Código INE municipio no válido: %', p_ine_code;
  end if;
  insert into avm_jobs (job_type, ine_code, status, payload)
  values (
    'municipality_onboard',
    v_code,
    'pending',
    jsonb_build_object('steps', array['portal_slugs','coverage_check','crawl_first','env_queue'])
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function trg_market_crawl_target_onboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform municipality_onboard_enqueue(new.municipality_code);
  return new;
end;
$$;

drop trigger if exists market_crawl_targets_onboard on market_crawl_targets;
create trigger market_crawl_targets_onboard
  after insert on market_crawl_targets
  for each row
  execute function trg_market_crawl_target_onboard();

-- Evitar doble encolado en el seed de A Coruña: solo nuevos municipios.

comment on table catastro_municipios is 'Callejero Sede del Catastro cruzado con INE; DNPLOC usa name_catastro.';
comment on function municipality_onboard_enqueue is 'Encola onboarding F: portales, cobertura, rastreo y entorno provincial.';
