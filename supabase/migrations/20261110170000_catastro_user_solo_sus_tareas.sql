-- CatastroUser solo ve y toca sus tareas (tablero, día del calendario y citas de tipo tarea).

create or replace function public.tarea_visible_para_mi(comercial uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_equipo()
    or (public.is_catastro_user() and comercial = auth.uid());
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
  select public.is_equipo()
    or (
      public.is_catastro_user()
      and (tipo is distinct from 'tarea' or comercial = auth.uid())
    );
$$;

revoke all on function public.cita_visible_para_mi(text, uuid) from public, anon;
grant execute on function public.cita_visible_para_mi(text, uuid) to authenticated;

drop policy if exists "Equipo lee tareas" on public.tareas;
drop policy if exists "Equipo crea tareas" on public.tareas;
drop policy if exists "Equipo actualiza tareas" on public.tareas;
drop policy if exists "Equipo borra tareas" on public.tareas;
create policy "Equipo lee tareas" on public.tareas
  for select using (public.tarea_visible_para_mi(comercial_id));
create policy "Equipo crea tareas" on public.tareas
  for insert with check (public.tarea_visible_para_mi(comercial_id));
create policy "Equipo actualiza tareas" on public.tareas
  for update using (public.tarea_visible_para_mi(comercial_id))
  with check (public.tarea_visible_para_mi(comercial_id));
create policy "Equipo borra tareas" on public.tareas
  for delete using (public.tarea_visible_para_mi(comercial_id));

drop policy if exists "Equipo lee actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo escribe actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo borra actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo actualiza notas de tareas" on public.tareas_actividad;

create policy "Equipo lee actividad de tareas" on public.tareas_actividad
  for select using (
    public.tarea_visible_para_mi((select t.comercial_id from public.tareas t where t.id = tarea_id))
  );
create policy "Equipo escribe actividad de tareas" on public.tareas_actividad
  for insert with check (
    public.tarea_visible_para_mi((select t.comercial_id from public.tareas t where t.id = tarea_id))
  );
create policy "Equipo borra actividad de tareas" on public.tareas_actividad
  for delete using (
    public.tarea_visible_para_mi((select t.comercial_id from public.tareas t where t.id = tarea_id))
  );
create policy "Equipo actualiza notas de tareas" on public.tareas_actividad
  for update
  to authenticated
  using (
    public.puede_editar_notas_crm()
    and tipo = 'nota'
    and public.tarea_visible_para_mi((select t.comercial_id from public.tareas t where t.id = tarea_id))
  )
  with check (
    public.puede_editar_notas_crm()
    and tipo = 'nota'
    and public.tarea_visible_para_mi((select t.comercial_id from public.tareas t where t.id = tarea_id))
  );

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
