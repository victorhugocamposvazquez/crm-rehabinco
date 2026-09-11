-- Fase 0 CRM inmobiliario: perfil comercial, ficha de inmueble, visitas atadas, Storage.

-- ---------------------------------------------------------------------------
-- 1. Perfiles: rol comercial + datos de ficha
-- ---------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'agente', 'comercial', 'editor'));

alter table public.profiles
  add column if not exists nombre_completo text,
  add column if not exists telefono text,
  add column if not exists foto_url text,
  add column if not exists color text not null default '#3A6A82',
  add column if not exists zona text,
  add column if not exists activo boolean not null default true;

-- El trigger impide cambios de rol si auth.uid() no es admin (p. ej. migraciones).
alter table public.profiles disable trigger trg_profiles_prevent_role_self_change;

update public.profiles
set role = 'comercial'
where role = 'agente';

alter table public.profiles enable trigger trg_profiles_prevent_role_self_change;

comment on table public.profiles is
  'Perfiles. Admin: todo. Comercial: inmobiliario + sus registros. Editor: solo presupuestos Garal. El valor agente se acepta por compatibilidad.';

drop policy if exists "Equipo ve fichas de comerciales" on public.profiles;
create policy "Equipo ve fichas de comerciales"
  on public.profiles for select
  using (public.is_admin() or public.is_agente());

create or replace function public.is_agente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('agente', 'comercial')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_role text;
  next_role text;
begin
  raw_role := coalesce(new.raw_user_meta_data->>'role', 'comercial');
  next_role := case
    when raw_role = 'agente' then 'comercial'
    when raw_role in ('admin', 'comercial', 'editor') then raw_role
    else 'comercial'
  end;

  insert into public.profiles (id, email, role, nombre_completo)
  values (
    new.id,
    new.email,
    next_role,
    nullif(trim(coalesce(new.raw_user_meta_data->>'nombre_completo', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        role = excluded.role,
        nombre_completo = coalesce(public.profiles.nombre_completo, excluded.nombre_completo);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Inmuebles (ampliar propiedades)
-- ---------------------------------------------------------------------------

alter table public.propiedades
  add column if not exists referencia text,
  add column if not exists tipo_inmueble text,
  add column if not exists tipologia text,
  add column if not exists banos int,
  add column if not exists aseos int,
  add column if not exists planta text,
  add column if not exists ascensor boolean,
  add column if not exists anio_construccion int,
  add column if not exists superficie_util numeric(10, 2),
  add column if not exists superficie_construida numeric(10, 2),
  add column if not exists superficie_parcela numeric(10, 2),
  add column if not exists referencia_catastral text,
  add column if not exists lat numeric(10, 6),
  add column if not exists lng numeric(10, 6),
  add column if not exists descripcion text,
  add column if not exists video_url text,
  add column if not exists comercial_id uuid references public.profiles (id) on delete set null,
  add column if not exists publicado boolean not null default false;

alter table public.propiedades
  drop constraint if exists propiedades_tipo_inmueble_check;

alter table public.propiedades
  add constraint propiedades_tipo_inmueble_check
  check (
    tipo_inmueble is null
    or tipo_inmueble in (
      'piso', 'atico', 'bajo', 'chalet', 'adosado', 'local',
      'oficina', 'nave', 'solar', 'garaje', 'trastero'
    )
  );

create unique index if not exists idx_propiedades_referencia
  on public.propiedades (referencia)
  where referencia is not null;

create index if not exists idx_propiedades_comercial_id on public.propiedades (comercial_id);
create index if not exists idx_propiedades_tipo_inmueble on public.propiedades (tipo_inmueble);

drop policy if exists "Comercial ve todo el stock" on public.propiedades;
create policy "Comercial ve todo el stock"
  on public.propiedades for select
  using (public.is_agente());

create or replace function public.siguiente_referencia_inmueble()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  anio int := extract(year from now())::int;
  prefijo text := 'RHB-' || anio::text || '-';
  max_n int;
begin
  select coalesce(max(substring(referencia from '[0-9]+$')::int), 0)
    into max_n
  from public.propiedades
  where referencia like prefijo || '%';

  return prefijo || lpad((max_n + 1)::text, 4, '0');
end;
$$;

create or replace function public.propiedades_asignar_referencia()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referencia is null or trim(new.referencia) = '' then
    new.referencia := public.siguiente_referencia_inmueble();
  end if;
  if new.comercial_id is null then
    new.comercial_id := new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propiedades_referencia on public.propiedades;
create trigger trg_propiedades_referencia
  before insert on public.propiedades
  for each row
  execute function public.propiedades_asignar_referencia();

do $$
declare
  r record;
begin
  for r in
    select id from public.propiedades where referencia is null order by created_at
  loop
    update public.propiedades
    set referencia = public.siguiente_referencia_inmueble()
    where id = r.id;
  end loop;
end $$;

update public.propiedades p
set comercial_id = p.user_id
where comercial_id is null;

-- ---------------------------------------------------------------------------
-- 3. Media del inmueble
-- ---------------------------------------------------------------------------

create table if not exists public.inmueble_media (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null default 'foto' check (tipo in ('foto', 'video', 'plano')),
  path text not null,
  url text not null,
  orden int not null default 0,
  portada boolean not null default false,
  created_at timestamptz default now()
);

comment on table public.inmueble_media is 'Fotos, vídeos y planos del inmueble (Storage bucket inmuebles).';

alter table public.inmueble_media enable row level security;

drop policy if exists "Admin puede todo en inmueble_media" on public.inmueble_media;
create policy "Admin puede todo en inmueble_media"
  on public.inmueble_media for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Comercial ve media de inmuebles" on public.inmueble_media;
create policy "Comercial ve media de inmuebles"
  on public.inmueble_media for select
  using (public.is_agente() or public.is_admin());

drop policy if exists "Comercial CRUD su media" on public.inmueble_media;
create policy "Comercial CRUD su media"
  on public.inmueble_media for all
  using (
    auth.uid() = user_id
    and public.is_agente()
    and exists (
      select 1
      from public.propiedades p
      where p.id = inmueble_media.propiedad_id
        and (p.user_id = auth.uid() or p.comercial_id = auth.uid())
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_agente()
    and exists (
      select 1
      from public.propiedades p
      where p.id = inmueble_media.propiedad_id
        and (p.user_id = auth.uid() or p.comercial_id = auth.uid())
    )
  );

create index if not exists idx_inmueble_media_propiedad on public.inmueble_media (propiedad_id, orden);

-- ---------------------------------------------------------------------------
-- 4. Partes de visita atados a inmueble / cliente / comercial
-- ---------------------------------------------------------------------------

alter table public.partes_visita
  add column if not exists propiedad_id uuid references public.propiedades (id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null,
  add column if not exists comercial_id uuid references public.profiles (id) on delete set null;

create index if not exists idx_partes_visita_propiedad on public.partes_visita (propiedad_id);
create index if not exists idx_partes_visita_cliente on public.partes_visita (cliente_id);
create index if not exists idx_partes_visita_comercial on public.partes_visita (comercial_id);

-- ---------------------------------------------------------------------------
-- 5. Storage: fotos de inmuebles
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('inmuebles', 'inmuebles', true)
on conflict (id) do update set public = true;

drop policy if exists "inmuebles_select_auth" on storage.objects;
create policy "inmuebles_select_auth"
  on storage.objects for select
  using (bucket_id = 'inmuebles');

drop policy if exists "inmuebles_insert_auth" on storage.objects;
create policy "inmuebles_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'inmuebles');

drop policy if exists "inmuebles_update_auth" on storage.objects;
create policy "inmuebles_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'inmuebles')
  with check (bucket_id = 'inmuebles');

drop policy if exists "inmuebles_delete_auth" on storage.objects;
create policy "inmuebles_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'inmuebles');
