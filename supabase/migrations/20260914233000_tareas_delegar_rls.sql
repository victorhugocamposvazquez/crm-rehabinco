-- Quien puede ver la tarea (asignado, creador o mencionado) también puede
-- reasignarla. El WITH CHECK anterior exigía seguir siendo asignado tras el
-- update, así que delegar fallaba en silencio.
drop policy if exists "Comercial actualiza sus tareas" on public.tareas;
create policy "Comercial actualiza sus tareas"
  on public.tareas for update
  to authenticated
  using (
    public.is_agente()
    and (
      comercial_id = auth.uid()
      or creado_por = auth.uid()
      or auth.uid() = any (mencionados)
    )
  )
  with check (public.is_agente());
