-- Ajustes RLS Fase 0: fichas visibles al equipo inmobiliario, media solo del propio stock.

drop policy if exists "Equipo ve fichas de comerciales" on public.profiles;
create policy "Equipo ve fichas de comerciales"
  on public.profiles for select
  using (public.is_admin() or public.is_agente());

drop policy if exists "Comercial CRUD su media" on public.inmueble_media;
create policy "Comercial CRUD su media"
  on public.inmueble_media for all
  using (
    auth.uid() = user_id
    and public.is_agente()
    and exists (
      select 1
      from public.propiedades p
      where p.id = inmueble_media.propiedad_id
        and (p.user_id = auth.uid() or p.comercial_id = auth.uid())
    )
  )
  with check (
    auth.uid() = user_id
    and public.is_agente()
    and exists (
      select 1
      from public.propiedades p
      where p.id = inmueble_media.propiedad_id
        and (p.user_id = auth.uid() or p.comercial_id = auth.uid())
    )
  );

revoke all on function public.siguiente_referencia_inmueble() from public, anon, authenticated;
revoke all on function public.propiedades_asignar_referencia() from public, anon, authenticated;
