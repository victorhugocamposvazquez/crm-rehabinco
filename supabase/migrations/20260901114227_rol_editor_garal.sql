-- Rol editor: solo presupuestos, siempre con emisor Garal.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'agente', 'editor'));

comment on table public.profiles is
  'Perfiles ligados a auth.users. Admin: acceso total. Agente: sus registros. Editor: solo presupuestos Garal.';

create or replace function public.is_agente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agente'
  );
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'editor'
  );
$$;

create or replace function public.emisor_presupuesto_garal_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.emisores_presupuesto where slug = 'garal' limit 1;
$$;

-- El editor no puede cambiarse el rol.
create or replace function public.prevent_profile_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'No puedes cambiar tu rol';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_role_self_change on public.profiles;
create trigger trg_profiles_prevent_role_self_change
  before update on public.profiles
  for each row
  execute function public.prevent_profile_role_self_change();

-- Facturas, pagos, inmuebles y visitas: solo admin (políticas propias) y agente.
drop policy if exists "Agente CRUD sus facturas" on public.facturas;
create policy "Agente CRUD sus facturas"
  on public.facturas for all
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

drop policy if exists "Acceso factura_lineas según factura" on public.factura_lineas;
create policy "Acceso factura_lineas según factura"
  on public.factura_lineas for all
  using (
    exists (
      select 1 from public.facturas f
      where f.id = factura_lineas.factura_id
        and (public.is_admin() or (f.user_id = auth.uid() and public.is_agente()))
    )
  )
  with check (
    exists (
      select 1 from public.facturas f
      where f.id = factura_lineas.factura_id
        and (public.is_admin() or (f.user_id = auth.uid() and public.is_agente()))
    )
  );

drop policy if exists "Agente CRUD pagos de sus facturas" on public.pagos;
create policy "Agente CRUD pagos de sus facturas"
  on public.pagos for all
  using (
    exists (
      select 1 from public.facturas f
      where f.id = pagos.factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  )
  with check (
    exists (
      select 1 from public.facturas f
      where f.id = pagos.factura_id
        and f.user_id = auth.uid()
        and public.is_agente()
    )
  );

drop policy if exists "Agente CRUD sus propiedades" on public.propiedades;
create policy "Agente CRUD sus propiedades"
  on public.propiedades for all
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

drop policy if exists "Agente CRUD sus partes_visita" on public.partes_visita;
create policy "Agente CRUD sus partes_visita"
  on public.partes_visita for all
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

drop policy if exists "Agente CRUD direcciones de sus clientes" on public.direcciones;
create policy "Agente CRUD direcciones de sus clientes"
  on public.direcciones for all
  using (
    exists (
      select 1 from public.clientes c
      where c.id = direcciones.cliente_id
        and c.user_id = auth.uid()
        and public.is_agente()
    )
  )
  with check (
    exists (
      select 1 from public.clientes c
      where c.id = direcciones.cliente_id
        and c.user_id = auth.uid()
        and public.is_agente()
    )
  );

-- Clientes: el agente sigue con los suyos; el editor solo lectura (para elegirlos en el presupuesto).
drop policy if exists "Agente CRUD sus clientes" on public.clientes;
create policy "Agente CRUD sus clientes"
  on public.clientes for all
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

drop policy if exists "Editor lee clientes para presupuestos" on public.clientes;
create policy "Editor lee clientes para presupuestos"
  on public.clientes for select
  using (public.is_editor());

-- Presupuestos del editor: los suyos, siempre Garal.
create or replace function public.force_emisor_garal_for_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_garal uuid;
begin
  if public.is_editor() then
    v_garal := public.emisor_presupuesto_garal_id();
    if v_garal is null then
      raise exception 'No existe el emisor Garal';
    end if;
    new.emisor_id := v_garal;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_presupuestos_editor_garal on public.presupuestos;
create trigger trg_presupuestos_editor_garal
  before insert or update on public.presupuestos
  for each row
  execute function public.force_emisor_garal_for_editor();
