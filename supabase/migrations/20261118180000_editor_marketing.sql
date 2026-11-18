-- Editor de marketing: entra al Estudio, pide revisión de un diseño
-- y la dirección recibe el aviso (campana y push).

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'agente', 'comercial', 'editor', 'catastro_user', 'marketing'));

comment on table public.profiles is
  'Perfiles. Superadmin: usuarios y APIs. Admin: dirección. Comercial: inmobiliario. Editor: presupuestos Garal. CatastroUser: archivo. Marketing: Estudio y revisión de diseños.';

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
  raw_role := coalesce(new.raw_app_meta_data->>'role', new.raw_user_meta_data->>'role', 'comercial');
  next_role := case
    when raw_role = 'agente' then 'comercial'
    when raw_role in ('superadmin', 'admin', 'comercial', 'editor', 'catastro_user', 'marketing') then raw_role
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

create or replace function public.is_marketing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'marketing'
  );
$$;

revoke all on function public.is_marketing() from public, anon;
grant execute on function public.is_marketing() to authenticated, service_role;

alter table public.role_permisos
  drop constraint if exists role_permisos_role_check;

alter table public.role_permisos
  add constraint role_permisos_role_check
  check (role in ('admin', 'comercial', 'editor', 'catastro_user', 'marketing'));

drop policy if exists "Marketing lee propiedades" on public.propiedades;
create policy "Marketing lee propiedades"
  on public.propiedades
  for select
  to authenticated
  using (public.is_marketing() and deleted_at is null);

drop policy if exists "Marketing lee fotos" on public.inmueble_media;
create policy "Marketing lee fotos"
  on public.inmueble_media
  for select
  to authenticated
  using (public.is_marketing());

create table if not exists public.estudio_revisiones (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  autor_id uuid not null references public.profiles (id),
  nota text not null default '',
  formato text not null,
  publicacion jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'vista')),
  created_at timestamptz not null default now()
);

create index if not exists idx_estudio_revisiones_estado
  on public.estudio_revisiones (estado, created_at desc);

alter table public.estudio_revisiones enable row level security;
revoke all on table public.estudio_revisiones from anon, public;
grant select, insert, update on table public.estudio_revisiones to authenticated;

drop policy if exists "Marketing crea su revisión" on public.estudio_revisiones;
create policy "Marketing crea su revisión"
  on public.estudio_revisiones
  for insert
  to authenticated
  with check (autor_id = auth.uid() and public.is_marketing());

drop policy if exists "Autor lee sus revisiones" on public.estudio_revisiones;
create policy "Autor lee sus revisiones"
  on public.estudio_revisiones
  for select
  to authenticated
  using (autor_id = auth.uid());

drop policy if exists "Dirección lee revisiones" on public.estudio_revisiones;
create policy "Dirección lee revisiones"
  on public.estudio_revisiones
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Dirección marca revisiones" on public.estudio_revisiones;
create policy "Dirección marca revisiones"
  on public.estudio_revisiones
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and estado in ('pendiente', 'vista'));

alter table public.crm_aviso_prefs
  add column if not exists estudio boolean not null default true;

comment on column public.crm_aviso_prefs.estudio is
  'Push y campana cuando el editor de marketing pide revisión de un diseño.';
