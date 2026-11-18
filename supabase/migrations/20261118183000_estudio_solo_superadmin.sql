-- Las revisiones del Estudio las ve y cierra el superadministrador.
-- El admin operativo no entra al Estudio.

drop policy if exists "Dirección lee revisiones" on public.estudio_revisiones;
drop policy if exists "Superadmin lee revisiones" on public.estudio_revisiones;
create policy "Superadmin lee revisiones"
  on public.estudio_revisiones
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists "Dirección marca revisiones" on public.estudio_revisiones;
drop policy if exists "Superadmin marca revisiones" on public.estudio_revisiones;
create policy "Superadmin marca revisiones"
  on public.estudio_revisiones
  for update
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin() and estado in ('pendiente', 'vista'));
