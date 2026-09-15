-- Superadmin: máximo privilegio. Admin operativo no ve APIs ni gestiona usuarios.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'agente', 'comercial', 'editor'));

comment on table public.profiles is
  'Perfiles. Superadmin: usuarios y APIs. Admin: operativa de dirección. Comercial: inmobiliario. Editor: presupuestos Garal.';

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.prevent_profile_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.role is distinct from old.role or new.activo is distinct from old.activo)
     and not public.is_superadmin() then
    raise exception 'Solo el superadministrador puede cambiar rol o acceso';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_role_self_change on public.profiles;
create trigger trg_profiles_prevent_role_self_change
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_self_change();

drop policy if exists "Admin puede todo en profiles" on public.profiles;
drop policy if exists "Superadmin puede todo en profiles" on public.profiles;
create policy "Superadmin puede todo en profiles"
  on public.profiles for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

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

update public.profiles
set role = 'superadmin', updated_at = now()
where lower(email) = 'hugo@admin.com';
