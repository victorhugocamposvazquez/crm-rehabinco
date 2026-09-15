-- Superadmin es dirección: las políticas antiguas solo miraban role = 'admin'.

drop policy if exists "Admin puede todo en propiedades" on public.propiedades;
create policy "Admin puede todo en propiedades"
  on public.propiedades for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin puede todo en direcciones" on public.direcciones;
create policy "Admin puede todo en direcciones"
  on public.direcciones for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin puede todo en partes_visita" on public.partes_visita;
create policy "Admin puede todo en partes_visita"
  on public.partes_visita for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin gestión emisores presupuesto" on public.emisores_presupuesto;
create policy "Admin gestión emisores presupuesto"
  on public.emisores_presupuesto for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admin gestión empresa facturación" on public.empresa_facturacion;
create policy "Admin gestión empresa facturación"
  on public.empresa_facturacion for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
