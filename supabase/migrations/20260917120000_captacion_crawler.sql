-- Captación por crawler: portales FK, cola, inmuebles deduplicados, contactos y Storage crudo.
-- Idealista queda inactivo; los anuncios existentes con fuente idealista no se tocan.

-- ---------------------------------------------------------------------------
-- 1. Catálogo de portales (FK en lugar de CHECK en fuente)
-- ---------------------------------------------------------------------------

create table if not exists public.captacion_portales (
  id text primary key,
  nombre text not null,
  activo boolean not null default false,
  transport text not null default 'http'
    check (transport in ('http', 'browser')),
  filtro_particular_nativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.captacion_portales is
  'Portales rastreables. activo=false excluye del scheduler del worker.';

insert into public.captacion_portales (id, nombre, activo, transport, filtro_particular_nativo)
values
  ('idealista', 'Idealista', false, 'http', true),
  ('habitaclia', 'Habitaclia', false, 'http', true),
  ('milanuncios', 'Milanuncios', false, 'http', false),
  ('fotocasa', 'Fotocasa', false, 'browser', true),
  ('pisos.com', 'pisos.com', false, 'http', true),
  ('wallapop', 'Wallapop', false, 'browser', false)
on conflict (id) do update set
  nombre = excluded.nombre,
  updated_at = now();

alter table public.captacion_portales enable row level security;
revoke all on table public.captacion_portales from anon, public;
grant select on table public.captacion_portales to authenticated;

create policy "Equipo lee portales captacion"
  on public.captacion_portales for select
  to authenticated
  using (public.is_admin() or public.is_agente());

-- Credenciales API (legacy Idealista/Fotocasa): FK al catálogo
alter table public.captacion_portales_credenciales
  drop constraint if exists captacion_portales_credenciales_portal_check;

alter table public.captacion_portales_credenciales
  add constraint captacion_portales_credenciales_portal_fkey
  foreign key (portal) references public.captacion_portales (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Zonas / alertas extendidas
-- ---------------------------------------------------------------------------

alter table public.captacion_alertas
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null,
  add column if not exists portal_id text references public.captacion_portales (id) on delete restrict,
  add column if not exists municipio text,
  add column if not exists provincia text,
  add column if not exists codigo_ine text,
  add column if not exists tipos_inmueble text[] not null default '{}'::text[],
  add column if not exists portal_params jsonb not null default '{}'::jsonb,
  add column if not exists cadencia_minutos integer not null default 120,
  add column if not exists proxima_ejecucion timestamptz;

create index if not exists idx_captacion_alertas_proxima
  on public.captacion_alertas (proxima_ejecucion)
  where activa and proxima_ejecucion is not null;

-- ---------------------------------------------------------------------------
-- 3. Cola y ejecuciones del worker
-- ---------------------------------------------------------------------------

create table if not exists public.crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('listado', 'detalle')),
  portal_id text not null references public.captacion_portales (id) on delete restrict,
  alerta_id uuid references public.captacion_alertas (id) on delete set null,
  url text not null,
  prioridad integer not null default 50,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'ok', 'error', 'bloqueado')),
  intentos integer not null default 0,
  bloqueado_hasta timestamptz,
  payload jsonb not null default '{}'::jsonb,
  resultado jsonb,
  error text,
  worker_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_crawl_jobs_pendiente
  on public.crawl_jobs (prioridad desc, created_at)
  where estado = 'pendiente';

create index if not exists idx_crawl_jobs_portal_estado
  on public.crawl_jobs (portal_id, estado);

comment on table public.crawl_jobs is
  'Cola de rastreo. Solo el worker (service_role) escribe.';

alter table public.crawl_jobs enable row level security;
revoke all on table public.crawl_jobs from anon, public, authenticated;

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.crawl_jobs (id) on delete set null,
  portal_id text not null references public.captacion_portales (id) on delete restrict,
  alerta_id uuid references public.captacion_alertas (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  http_status integer,
  bloqueado boolean not null default false,
  paginas integer not null default 0,
  anuncios_vistos integer not null default 0,
  anuncios_nuevos integer not null default 0,
  bytes_descargados bigint not null default 0,
  proxy_sesion text,
  parser_version text,
  error text
);

create index if not exists idx_crawl_runs_portal_started
  on public.crawl_runs (portal_id, started_at desc);

alter table public.crawl_runs enable row level security;
revoke all on table public.crawl_runs from anon, public, authenticated;

create table if not exists public.crawl_portal_estado (
  portal_id text primary key references public.captacion_portales (id) on delete cascade,
  bloqueado_hasta timestamptz,
  bloqueos_recientes integer not null default 0,
  ventana_desde timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.crawl_portal_estado is
  'Circuit breaker por portal (3 bloqueos / 15 min → pausa 60 min).';

alter table public.crawl_portal_estado enable row level security;
revoke all on table public.crawl_portal_estado from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Inmuebles deduplicados y contactos
-- ---------------------------------------------------------------------------

create table if not exists public.captacion_inmuebles (
  id uuid primary key default gen_random_uuid(),
  operacion text not null check (operacion in ('venta', 'alquiler')),
  tipo text,
  municipio text,
  precio_actual numeric,
  precio_minimo numeric,
  superficie numeric,
  habitaciones integer,
  lat double precision,
  lng double precision,
  geo_aproximada boolean not null default false,
  visto_primera_vez timestamptz not null default now(),
  visto_ultima_vez timestamptz not null default now(),
  activo boolean not null default true,
  portales text[] not null default '{}'::text[],
  phash_fotos text[] not null default '{}'::text[],
  motivo_union jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captacion_inmuebles_activo
  on public.captacion_inmuebles (activo, municipio);

alter table public.captacion_inmuebles enable row level security;
revoke all on table public.captacion_inmuebles from anon, public;
grant select, insert, update on table public.captacion_inmuebles to authenticated;

create policy "Equipo lee inmuebles captacion"
  on public.captacion_inmuebles for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo escribe inmuebles captacion"
  on public.captacion_inmuebles for all
  to authenticated
  using (public.is_admin() or public.is_agente())
  with check (public.is_admin() or public.is_agente());

create table if not exists public.captacion_contactos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  telefono_e164 text,
  nombre_norm text,
  municipio text,
  anuncios_activos integer not null default 0,
  anuncios_historicos integer not null default 0,
  municipios text[] not null default '{}'::text[],
  portales text[] not null default '{}'::text[],
  operaciones text[] not null default '{}'::text[],
  tipos text[] not null default '{}'::text[],
  score_profesional integer not null default 0 check (score_profesional between 0 and 100),
  senales jsonb not null default '[]'::jsonb,
  nivel_aviso text not null default 'ninguno'
    check (nivel_aviso in ('ninguno', 'amarillo', 'rojo')),
  clasificacion_manual text check (clasificacion_manual in ('particular', 'profesional')),
  clasificado_por uuid references auth.users (id) on delete set null,
  clasificado_en timestamptz,
  excluido boolean not null default false,
  cliente_id uuid references public.clientes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captacion_contactos_nivel
  on public.captacion_contactos (nivel_aviso, excluido);

alter table public.captacion_contactos enable row level security;
revoke all on table public.captacion_contactos from anon, public;
grant select, insert, update on table public.captacion_contactos to authenticated;

create policy "Equipo lee contactos captacion"
  on public.captacion_contactos for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo escribe contactos captacion"
  on public.captacion_contactos for all
  to authenticated
  using (public.is_admin() or public.is_agente())
  with check (public.is_admin() or public.is_agente());

create table if not exists public.captacion_exclusiones (
  id uuid primary key default gen_random_uuid(),
  telefono_e164 text not null unique,
  motivo text not null,
  origen text not null default 'manual',
  creado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.captacion_exclusiones enable row level security;
revoke all on table public.captacion_exclusiones from anon, public;
grant select, insert, delete on table public.captacion_exclusiones to authenticated;

create policy "Admin gestiona exclusiones captacion"
  on public.captacion_exclusiones for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Equipo lee exclusiones captacion"
  on public.captacion_exclusiones for select
  to authenticated
  using (public.is_agente());

create table if not exists public.captacion_pesos_senales (
  senal text primary key,
  peso integer not null default 0,
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.captacion_pesos_senales (senal, peso) values
  ('portal_profesional', 60),
  ('nombre_comercial', 40),
  ('nombre_marca', 35),
  ('telefono_fijo', 20),
  ('muchos_anuncios_3_4', 20),
  ('muchos_anuncios_5', 40),
  ('varios_municipios', 25),
  ('venta_y_alquiler', 20),
  ('varios_tipos', 25),
  ('varios_portales', 15),
  ('jerga_agencia', 20),
  ('tercera_persona', 10),
  ('cadencia_larga', 25),
  ('rotacion', 20),
  ('plantilla_compartida', 30),
  ('fotos_compartidas', 30)
on conflict (senal) do nothing;

alter table public.captacion_pesos_senales enable row level security;
revoke all on table public.captacion_pesos_senales from anon, public;
grant select on table public.captacion_pesos_senales to authenticated;

create policy "Equipo lee pesos senales"
  on public.captacion_pesos_senales for select
  to authenticated
  using (public.is_admin() or public.is_agente());

-- ---------------------------------------------------------------------------
-- 5. Anuncios extendidos + historial
-- ---------------------------------------------------------------------------

alter table public.captacion_anuncios
  add column if not exists portal_id text references public.captacion_portales (id) on delete restrict,
  add column if not exists inmueble_id uuid references public.captacion_inmuebles (id) on delete set null,
  add column if not exists contacto_id uuid references public.captacion_contactos (id) on delete set null,
  add column if not exists planta text,
  add column if not exists geo_aproximada boolean not null default false,
  add column if not exists nombre_comercial text,
  add column if not exists visto_primera_vez timestamptz,
  add column if not exists hash_contenido text,
  add column if not exists raw_path text,
  add column if not exists parser_version text;

update public.captacion_anuncios
set portal_id = fuente
where portal_id is null and fuente is not null;

update public.captacion_anuncios
set visto_primera_vez = coalesce(visto_primera_vez, visto_en, created_at)
where visto_primera_vez is null;

alter table public.captacion_anuncios
  drop constraint if exists captacion_anuncios_fuente_check;

-- fuente se mantiene denormalizado; portal_id es la FK oficial
create index if not exists idx_captacion_anuncios_portal
  on public.captacion_anuncios (portal_id, externo_id);

create index if not exists idx_captacion_anuncios_inmueble
  on public.captacion_anuncios (inmueble_id);

create table if not exists public.captacion_anuncios_historial (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.captacion_anuncios (id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  detectado_en timestamptz not null default now()
);

create index if not exists idx_captacion_anuncios_historial_anuncio
  on public.captacion_anuncios_historial (anuncio_id, detectado_en desc);

alter table public.captacion_anuncios_historial enable row level security;
revoke all on table public.captacion_anuncios_historial from anon, public;
grant select, insert on table public.captacion_anuncios_historial to authenticated;

create policy "Equipo lee historial anuncios"
  on public.captacion_anuncios_historial for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo inserta historial anuncios"
  on public.captacion_anuncios_historial for insert
  to authenticated
  with check (public.is_admin() or public.is_agente());

-- ---------------------------------------------------------------------------
-- 6. Storage privado crawl-raw
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('crawl-raw', 'crawl-raw', false, 52428800)
on conflict (id) do nothing;

-- service_role escribe; authenticated no lee crudo por defecto

-- ---------------------------------------------------------------------------
-- 7. RPC: reclamar jobs (worker)
-- ---------------------------------------------------------------------------

create or replace function public.crawl_reclamar_jobs(
  p_limite integer default 1,
  p_worker_id text default null
)
returns setof public.crawl_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidatos as (
    select j.id
    from public.crawl_jobs j
    left join public.crawl_portal_estado pe on pe.portal_id = j.portal_id
    where j.estado = 'pendiente'
      and (j.bloqueado_hasta is null or j.bloqueado_hasta <= now())
      and (pe.bloqueado_hasta is null or pe.bloqueado_hasta <= now())
    order by j.prioridad desc, j.created_at
    limit p_limite
    for update of j skip locked
  )
  update public.crawl_jobs j
  set
    estado = 'en_curso',
    worker_id = p_worker_id,
    started_at = now(),
    updated_at = now(),
    intentos = j.intentos + 1
  from candidatos c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.crawl_reclamar_jobs(integer, text) from public, anon, authenticated;
