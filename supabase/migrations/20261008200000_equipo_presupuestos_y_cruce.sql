-- El comercial puede guardar un presupuesto o una factura que no creó él.
-- Garaje, terraza y exterior se guardan en el inmueble para que el cruce los mire.

alter table public.propiedades
  add column if not exists garaje boolean,
  add column if not exists terraza boolean,
  add column if not exists exterior boolean;

drop policy if exists "Equipo gestiona presupuestos" on public.presupuestos;
create policy "Equipo gestiona presupuestos"
  on public.presupuestos
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Acceso presupuesto_lineas según presupuesto" on public.presupuesto_lineas;
drop policy if exists "Equipo gestiona lineas de presupuesto" on public.presupuesto_lineas;
create policy "Equipo gestiona lineas de presupuesto"
  on public.presupuesto_lineas
  for all
  using (
    public.is_equipo()
    or exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    public.is_equipo()
    or exists (
      select 1 from public.presupuestos p
      where p.id = presupuesto_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Equipo gestiona facturas" on public.facturas;
create policy "Equipo gestiona facturas"
  on public.facturas
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Acceso factura_lineas según factura" on public.factura_lineas;
drop policy if exists "Equipo gestiona lineas de factura" on public.factura_lineas;
create policy "Equipo gestiona lineas de factura"
  on public.factura_lineas
  for all
  using (
    public.is_equipo()
    or exists (
      select 1 from public.facturas f
      where f.id = factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  )
  with check (
    public.is_equipo()
    or exists (
      select 1 from public.facturas f
      where f.id = factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  );

drop policy if exists "Equipo gestiona pagos" on public.pagos;
create policy "Equipo gestiona pagos"
  on public.pagos
  for all
  using (
    public.is_equipo()
    or exists (
      select 1 from public.facturas f
      where f.id = factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  )
  with check (
    public.is_equipo()
    or exists (
      select 1 from public.facturas f
      where f.id = factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  );
