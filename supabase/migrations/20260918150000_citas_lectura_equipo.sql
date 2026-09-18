-- Calendario compartido: cualquier agente puede ver todas las citas del equipo.
drop policy if exists "Comercial lee citas" on public.citas;

create policy "Comercial lee citas"
  on public.citas for select
  to authenticated
  using (public.is_agente());

comment on policy "Comercial lee citas" on public.citas is
  'Agenda visible para todo el equipo; crear/editar/borrar sigue siendo por comercial o admin.';
