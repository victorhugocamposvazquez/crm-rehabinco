-- Rol CatastroUser: catastro completo, contactos, tareas y calendario.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'agente', 'comercial', 'editor', 'catastro_user'));

create or replace function public.is_catastro_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'catastro_user'
  );
$$;

revoke all on function public.is_catastro_user() from public, anon;
grant execute on function public.is_catastro_user() to authenticated;

create or replace function public.is_catastro_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_catastro_user();
$$;

revoke all on function public.is_catastro_gestor() from public, anon;
grant execute on function public.is_catastro_gestor() to authenticated;

create or replace function public.is_equipo_o_catastro_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_equipo() or public.is_catastro_user();
$$;

revoke all on function public.is_equipo_o_catastro_user() from public, anon;
grant execute on function public.is_equipo_o_catastro_user() to authenticated;

-- Agenda y contactos (sin stock ni facturación).
drop policy if exists "Equipo gestiona clientes" on public.clientes;
create policy "Equipo gestiona clientes"
  on public.clientes
  for all
  using (public.is_equipo_o_catastro_user())
  with check (public.is_equipo_o_catastro_user());

drop policy if exists "Equipo lee notas de clientes" on public.clientes_notas;
create policy "Equipo lee notas de clientes"
  on public.clientes_notas for select
  to authenticated
  using (public.is_equipo_o_catastro_user() or public.is_editor());
drop policy if exists "Equipo escribe notas de clientes" on public.clientes_notas;
create policy "Equipo escribe notas de clientes"
  on public.clientes_notas for insert
  to authenticated
  with check (public.is_equipo_o_catastro_user());

drop policy if exists "Equipo lee citas" on public.citas;
drop policy if exists "Equipo crea citas" on public.citas;
drop policy if exists "Equipo actualiza citas" on public.citas;
drop policy if exists "Equipo borra citas" on public.citas;
create policy "Equipo lee citas" on public.citas for select using (public.is_equipo_o_catastro_user());
create policy "Equipo crea citas" on public.citas for insert with check (public.is_equipo_o_catastro_user());
create policy "Equipo actualiza citas" on public.citas for update using (public.is_equipo_o_catastro_user()) with check (public.is_equipo_o_catastro_user());
create policy "Equipo borra citas" on public.citas for delete using (public.is_equipo_o_catastro_user());

drop policy if exists "Equipo lee tareas" on public.tareas;
drop policy if exists "Equipo crea tareas" on public.tareas;
drop policy if exists "Equipo actualiza tareas" on public.tareas;
drop policy if exists "Equipo borra tareas" on public.tareas;
create policy "Equipo lee tareas" on public.tareas for select using (public.is_equipo_o_catastro_user());
create policy "Equipo crea tareas" on public.tareas for insert with check (public.is_equipo_o_catastro_user());
create policy "Equipo actualiza tareas" on public.tareas for update using (public.is_equipo_o_catastro_user()) with check (public.is_equipo_o_catastro_user());
create policy "Equipo borra tareas" on public.tareas for delete using (public.is_equipo_o_catastro_user());

drop policy if exists "Equipo lee actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo escribe actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo borra actividad de tareas" on public.tareas_actividad;
create policy "Equipo lee actividad de tareas" on public.tareas_actividad for select using (public.is_equipo_o_catastro_user());
create policy "Equipo escribe actividad de tareas" on public.tareas_actividad for insert with check (public.is_equipo_o_catastro_user());
create policy "Equipo borra actividad de tareas" on public.tareas_actividad for delete using (public.is_equipo_o_catastro_user());

-- Catastro explorer: mismas capacidades operativas que dirección.
drop policy if exists "Admin gestiona asignaciones catastro" on public.catastro_explorer_assignments;
create policy "Admin gestiona asignaciones catastro"
  on public.catastro_explorer_assignments for all
  to authenticated
  using (public.is_catastro_gestor())
  with check (public.is_catastro_gestor());

drop policy if exists "Admin lee todas las busquedas catastro" on public.catastro_explorer_searches;
create policy "Admin lee todas las busquedas catastro"
  on public.catastro_explorer_searches for select
  to authenticated
  using (public.is_catastro_gestor());

drop policy if exists "Admin lee resultados busquedas catastro" on public.catastro_explorer_search_results;
create policy "Admin lee resultados busquedas catastro"
  on public.catastro_explorer_search_results for select
  to authenticated
  using (public.is_catastro_gestor());

drop policy if exists "Admin lee revisiones catastro" on public.catastro_explorer_reviews;
create policy "Admin lee revisiones catastro"
  on public.catastro_explorer_reviews for select
  to authenticated
  using (public.is_catastro_gestor());

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
    when raw_role in ('superadmin', 'admin', 'comercial', 'editor', 'catastro_user') then raw_role
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
