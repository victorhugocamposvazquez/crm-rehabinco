-- Cualquier rol autenticado ficha su propia jornada.
-- La dirección sigue viendo el equipo y resolviendo correcciones.

drop policy if exists "Equipo lee centros fichaje" on public.fichaje_centros;
create policy "Equipo lee centros fichaje"
  on public.fichaje_centros for select
  to authenticated
  using (true);

drop policy if exists "Equipo lee festivos fichaje" on public.fichaje_festivos;
create policy "Equipo lee festivos fichaje"
  on public.fichaje_festivos for select
  to authenticated
  using (true);

drop policy if exists "Empleado inserta sus punches" on public.fichaje_punches;
create policy "Empleado inserta sus punches"
  on public.fichaje_punches for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Empleado solicita correccion" on public.fichaje_corrections;
create policy "Empleado solicita correccion"
  on public.fichaje_corrections for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and user_id = auth.uid()
  );

drop policy if exists "Equipo escribe auditoria fichaje" on public.fichaje_audit_log;
create policy "Equipo escribe auditoria fichaje"
  on public.fichaje_audit_log for insert
  to authenticated
  with check (actor_id = auth.uid() or public.is_admin());

drop policy if exists "Equipo lee protocolo fichaje" on public.fichaje_protocolo;
create policy "Equipo lee protocolo fichaje"
  on public.fichaje_protocolo for select
  to authenticated
  using (true);

drop policy if exists "Equipo lee fichajes storage" on storage.objects;
create policy "Equipo lee fichajes storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fichajes'
    and (
      public.is_admin()
      or name like 'protocolo/%'
      or name like (auth.uid()::text || '/%')
    )
  );
