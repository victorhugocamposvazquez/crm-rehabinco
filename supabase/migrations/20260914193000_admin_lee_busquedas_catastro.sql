-- Dirección ve todas las búsquedas de Catastro Explorer (archivo de territorio).
-- El comercial sigue viendo solo las suyas.

drop policy if exists "Admin lee todas las busquedas catastro" on public.catastro_explorer_searches;
create policy "Admin lee todas las busquedas catastro"
  on public.catastro_explorer_searches for select
  to authenticated
  using (public.is_admin());
