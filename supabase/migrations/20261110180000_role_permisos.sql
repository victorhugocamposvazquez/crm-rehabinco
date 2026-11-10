-- Permisos por rol que el superadmin marca en Ajustes.
-- Sin filas, cada rol sigue como hasta ahora.

create table if not exists public.role_permisos (
  role text not null check (role in ('admin', 'comercial', 'editor', 'catastro_user')),
  permiso text not null,
  activo boolean not null,
  updated_at timestamptz not null default now(),
  primary key (role, permiso)
);

alter table public.role_permisos enable row level security;

drop policy if exists "Autenticados leen permisos de rol" on public.role_permisos;
create policy "Autenticados leen permisos de rol"
  on public.role_permisos for select
  to authenticated
  using (true);

drop policy if exists "Superadmin escribe permisos de rol" on public.role_permisos;
create policy "Superadmin escribe permisos de rol"
  on public.role_permisos for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create or replace function public.permiso_activo(permiso text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_superadmin() then true
    else coalesce(
      (
        select rp.activo
        from public.role_permisos rp
        join public.profiles p on p.role = rp.role
        where p.id = auth.uid()
          and rp.permiso = permiso_activo.permiso
      ),
      case
        when permiso_activo.permiso = 'tareas_equipo' then public.is_equipo()
        else null
      end
    )
  end;
$$;

revoke all on function public.permiso_activo(text) from public, anon;
grant execute on function public.permiso_activo(text) to authenticated;

create or replace function public.tarea_visible_para_mi(comercial uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.permiso_activo('tareas_equipo'), public.is_equipo())
    or comercial = auth.uid();
$$;

revoke all on function public.tarea_visible_para_mi(uuid) from public, anon;
grant execute on function public.tarea_visible_para_mi(uuid) to authenticated;

create or replace function public.cita_visible_para_mi(tipo text, comercial uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_equipo_o_catastro_user()
    and (
      tipo is distinct from 'tarea'
      or coalesce(public.permiso_activo('tareas_equipo'), public.is_equipo())
      or comercial = auth.uid()
    );
$$;

revoke all on function public.cita_visible_para_mi(text, uuid) from public, anon;
grant execute on function public.cita_visible_para_mi(text, uuid) to authenticated;

drop policy if exists "Equipo lee tareas" on public.tareas;
drop policy if exists "Equipo crea tareas" on public.tareas;
drop policy if exists "Equipo actualiza tareas" on public.tareas;
drop policy if exists "Equipo borra tareas" on public.tareas;
create policy "Equipo lee tareas" on public.tareas
  for select using (public.is_equipo_o_catastro_user() and public.tarea_visible_para_mi(comercial_id));
create policy "Equipo crea tareas" on public.tareas
  for insert with check (public.is_equipo_o_catastro_user() and public.tarea_visible_para_mi(comercial_id));
create policy "Equipo actualiza tareas" on public.tareas
  for update using (public.is_equipo_o_catastro_user() and public.tarea_visible_para_mi(comercial_id))
  with check (public.is_equipo_o_catastro_user() and public.tarea_visible_para_mi(comercial_id));
create policy "Equipo borra tareas" on public.tareas
  for delete using (public.is_equipo_o_catastro_user() and public.tarea_visible_para_mi(comercial_id));

drop policy if exists "Equipo lee citas" on public.citas;
drop policy if exists "Equipo crea citas" on public.citas;
drop policy if exists "Equipo actualiza citas" on public.citas;
drop policy if exists "Equipo borra citas" on public.citas;
create policy "Equipo lee citas" on public.citas
  for select using (public.cita_visible_para_mi(tipo, comercial_id));
create policy "Equipo crea citas" on public.citas
  for insert with check (public.cita_visible_para_mi(tipo, comercial_id));
create policy "Equipo actualiza citas" on public.citas
  for update using (public.cita_visible_para_mi(tipo, comercial_id))
  with check (public.cita_visible_para_mi(tipo, comercial_id));
create policy "Equipo borra citas" on public.citas
  for delete using (public.cita_visible_para_mi(tipo, comercial_id));

drop policy if exists "Admin gestión empresa facturación" on public.empresa_facturacion;
create policy "Admin gestión empresa facturación"
  on public.empresa_facturacion for all
  to authenticated
  using (coalesce(public.permiso_activo('empresa'), public.is_admin()))
  with check (coalesce(public.permiso_activo('empresa'), public.is_admin()));

drop policy if exists "Admin gestión emisores presupuesto" on public.emisores_presupuesto;
create policy "Admin gestión emisores presupuesto"
  on public.emisores_presupuesto for all
  to authenticated
  using (coalesce(public.permiso_activo('empresa'), public.is_admin()))
  with check (coalesce(public.permiso_activo('empresa'), public.is_admin()));
