-- Dirección (admin/superadmin) lee resultados y revisiones de búsquedas del equipo.
-- Las búsquedas ya tenían política "Admin lee todas las busquedas catastro".

drop policy if exists "Admin lee resultados busquedas catastro" on public.catastro_explorer_search_results;
create policy "Admin lee resultados busquedas catastro"
  on public.catastro_explorer_search_results for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin lee revisiones catastro" on public.catastro_explorer_reviews;
create policy "Admin lee revisiones catastro"
  on public.catastro_explorer_reviews for select
  to authenticated
  using (public.is_admin());
