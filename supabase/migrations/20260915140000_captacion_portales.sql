-- Anuncios de portales (Idealista / Fotocasa / Milanuncios) para Captación.
-- Independiente de Catastro Explorer.

alter table public.propiedades
  drop constraint if exists propiedades_origen_check;

alter table public.propiedades
  add constraint propiedades_origen_check
  check (origen in ('MANUAL', 'CATASTRO_EXPLORER', 'PORTAL'));

comment on column public.propiedades.origen is
  'MANUAL = alta CRM. CATASTRO_EXPLORER = Catastro. PORTAL = captado desde anuncio de portal.';

create table if not exists public.captacion_alertas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  portales text[] not null default array['idealista']::text[],
  zonas text[] not null default '{}'::text[],
  center_lat double precision,
  center_lng double precision,
  radio_m integer not null default 15000,
  operacion text not null default 'venta'
    check (operacion in ('venta', 'alquiler')),
  tipo text,
  precio_max numeric,
  m2_min numeric,
  solo_particulares boolean not null default true,
  frecuencia text not null default 'diaria'
    check (frecuencia in ('hora', '6h', 'diaria')),
  activa boolean not null default true,
  comercial_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete restrict,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.captacion_alertas is
  'Búsqueda guardada en portales. Lo que encuentra cae en Novedades.';

create index if not exists idx_captacion_alertas_activa
  on public.captacion_alertas (activa) where activa;

alter table public.captacion_alertas enable row level security;
revoke all on table public.captacion_alertas from anon, public;
grant select, insert, update, delete on table public.captacion_alertas to authenticated;

create policy "Equipo lee alertas captacion"
  on public.captacion_alertas for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo crea alertas captacion"
  on public.captacion_alertas for insert
  to authenticated
  with check (
    (public.is_admin() or public.is_agente())
    and created_by = auth.uid()
  );

create policy "Admin escribe alertas captacion"
  on public.captacion_alertas for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial actualiza sus alertas captacion"
  on public.captacion_alertas for update
  to authenticated
  using (public.is_agente() and created_by = auth.uid())
  with check (public.is_agente() and created_by = auth.uid());

create policy "Admin borra alertas captacion"
  on public.captacion_alertas for delete
  to authenticated
  using (public.is_admin());

create policy "Comercial borra sus alertas captacion"
  on public.captacion_alertas for delete
  to authenticated
  using (public.is_agente() and created_by = auth.uid());

create table if not exists public.captacion_anuncios (
  id uuid primary key default gen_random_uuid(),
  fuente text not null
    check (fuente in ('idealista', 'fotocasa', 'milanuncios')),
  externo_id text not null,
  url text,
  titulo text not null,
  descripcion text,
  operacion text not null default 'venta'
    check (operacion in ('venta', 'alquiler')),
  tipo text,
  anunciante text not null default 'desconocido'
    check (anunciante in ('particular', 'empresa', 'banco', 'desconocido')),
  precio numeric,
  precio_anterior numeric,
  superficie numeric,
  habitaciones integer,
  banos integer,
  direccion text,
  zona text,
  municipio text,
  codigo_postal text,
  lat double precision,
  lng double precision,
  thumb text,
  n_fotos integer,
  fotos jsonb not null default '[]'::jsonb,
  contacto_nombre text,
  contacto_telefono text,
  contacto_clave text,
  tags text[] not null default '{}'::text[],
  alerta_id uuid references public.captacion_alertas (id) on delete set null,
  fase text not null default 'novedad'
    check (fase in ('novedad', 'contacto', 'visita', 'negociando', 'captado', 'perdido', 'descartado')),
  comercial_id uuid references public.profiles (id) on delete set null,
  proxima_accion text,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  publicado_en timestamptz,
  visto_en timestamptz not null default now(),
  desaparecido_en timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fuente, externo_id)
);

comment on table public.captacion_anuncios is
  'Anuncio detectado en un portal. No es stock de Rehabinco hasta fase captado.';

create index if not exists idx_captacion_anuncios_fase
  on public.captacion_anuncios (fase);
create index if not exists idx_captacion_anuncios_comercial
  on public.captacion_anuncios (comercial_id);
create index if not exists idx_captacion_anuncios_municipio
  on public.captacion_anuncios (municipio);
create index if not exists idx_captacion_anuncios_clave
  on public.captacion_anuncios (contacto_clave)
  where contacto_clave is not null;
create index if not exists idx_captacion_anuncios_alerta
  on public.captacion_anuncios (alerta_id);

alter table public.captacion_anuncios enable row level security;
revoke all on table public.captacion_anuncios from anon, public;
grant select, insert, update on table public.captacion_anuncios to authenticated;

create policy "Equipo lee anuncios captacion"
  on public.captacion_anuncios for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo inserta anuncios captacion"
  on public.captacion_anuncios for insert
  to authenticated
  with check (public.is_admin() or public.is_agente());

create policy "Equipo actualiza anuncios captacion"
  on public.captacion_anuncios for update
  to authenticated
  using (public.is_admin() or public.is_agente())
  with check (public.is_admin() or public.is_agente());

create table if not exists public.captacion_anuncios_actividad (
  id uuid primary key default gen_random_uuid(),
  anuncio_id uuid not null references public.captacion_anuncios (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  tipo text not null
    check (tipo in ('detectado', 'asignacion', 'fase', 'bajada', 'nota', 'catastro', 'captado', 'retirado')),
  detalle text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_captacion_anuncios_actividad
  on public.captacion_anuncios_actividad (anuncio_id, created_at desc);

alter table public.captacion_anuncios_actividad enable row level security;
revoke all on table public.captacion_anuncios_actividad from anon, public;
grant select, insert on table public.captacion_anuncios_actividad to authenticated;

create policy "Equipo lee actividad anuncios"
  on public.captacion_anuncios_actividad for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo escribe actividad anuncios"
  on public.captacion_anuncios_actividad for insert
  to authenticated
  with check (public.is_admin() or public.is_agente());

create table if not exists public.captacion_notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  detalle text,
  anuncio_id uuid references public.captacion_anuncios (id) on delete set null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_captacion_notifs_user
  on public.captacion_notificaciones (user_id, leida, created_at desc);

alter table public.captacion_notificaciones enable row level security;
revoke all on table public.captacion_notificaciones from anon, public;
grant select, insert, update on table public.captacion_notificaciones to authenticated;

create policy "Usuario lee sus notifs captacion"
  on public.captacion_notificaciones for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Usuario actualiza sus notifs captacion"
  on public.captacion_notificaciones for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Equipo inserta notifs captacion"
  on public.captacion_notificaciones for insert
  to authenticated
  with check (public.is_admin() or public.is_agente());

create table if not exists public.captacion_notif_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nuevos boolean not null default true,
  bajada boolean not null default true,
  retirado boolean not null default true,
  telefono_repite boolean not null default false,
  sin_mover boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.captacion_notif_prefs enable row level security;
revoke all on table public.captacion_notif_prefs from anon, public;
grant select, insert, update on table public.captacion_notif_prefs to authenticated;

create policy "Usuario lee sus prefs captacion"
  on public.captacion_notif_prefs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuario escribe sus prefs captacion"
  on public.captacion_notif_prefs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Usuario actualiza sus prefs captacion"
  on public.captacion_notif_prefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
