-- Quien crea o gestiona una cita puede asignarla a otro comercial del equipo.
-- Antes el WITH CHECK exigía comercial_id = auth.uid() tras el update,
-- así que reasignar fallaba en silencio.

drop policy if exists "Comercial crea sus citas" on public.citas;
create policy "Comercial crea citas del equipo"
  on public.citas for insert
  to authenticated
  with check (public.is_agente());

drop policy if exists "Comercial actualiza sus citas" on public.citas;
create policy "Comercial actualiza sus citas"
  on public.citas for update
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid())
  with check (public.is_agente());

comment on policy "Comercial crea citas del equipo" on public.citas is
  'Un agente puede crear la cita a nombre de otro comercial.';
comment on policy "Comercial actualiza sus citas" on public.citas is
  'El asignado puede editar y reasignar la cita a otro del equipo.';
