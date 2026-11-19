-- Los administradores leen y marcan las revisiones del Estudio.
-- El editor sigue fuera de su alcance.

drop policy if exists "Superadmin lee revisiones" on public.estudio_revisiones;
drop policy if exists "Admin lee revisiones" on public.estudio_revisiones;
create policy "Admin lee revisiones"
  on public.estudio_revisiones
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Superadmin marca revisiones" on public.estudio_revisiones;
drop policy if exists "Admin marca revisiones" on public.estudio_revisiones;
create policy "Admin marca revisiones"
  on public.estudio_revisiones
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and estado in ('pendiente', 'vista'));
