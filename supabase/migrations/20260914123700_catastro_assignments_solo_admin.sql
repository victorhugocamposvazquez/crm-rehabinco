-- El comercial solo lee las fincas que le asignan. Asignar es de admin.

drop policy if exists "Equipo lee asignaciones catastro" on public.catastro_explorer_assignments;
drop policy if exists "Equipo crea asignaciones catastro" on public.catastro_explorer_assignments;
drop policy if exists "Equipo actualiza asignaciones catastro" on public.catastro_explorer_assignments;
drop policy if exists "Equipo borra asignaciones catastro" on public.catastro_explorer_assignments;

create policy "Admin gestiona asignaciones catastro"
  on public.catastro_explorer_assignments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial lee sus asignaciones catastro"
  on public.catastro_explorer_assignments for select
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());
