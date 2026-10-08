-- Admin y comercial no se solapan. Una sola puerta para la operativa del equipo.

create or replace function public.is_equipo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('superadmin', 'admin', 'agente', 'comercial')
  );
$$;

revoke all on function public.is_equipo() from public, anon;
grant execute on function public.is_equipo() to authenticated;

-- Agenda compartida.
drop policy if exists "Agente CRUD sus clientes" on public.clientes;
drop policy if exists "Equipo gestiona clientes" on public.clientes;
create policy "Equipo gestiona clientes"
  on public.clientes
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

-- Stock: ver y editar, no solo los propios.
drop policy if exists "Agente CRUD sus propiedades" on public.propiedades;
drop policy if exists "Equipo gestiona propiedades" on public.propiedades;
create policy "Equipo gestiona propiedades"
  on public.propiedades
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Comercial CRUD su media" on public.inmueble_media;
drop policy if exists "Equipo gestiona media de inmuebles" on public.inmueble_media;
create policy "Equipo gestiona media de inmuebles"
  on public.inmueble_media
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Equipo borra documentos inmueble" on public.inmueble_documentos;
drop policy if exists "Equipo sube documentos inmueble" on public.inmueble_documentos;
drop policy if exists "Equipo gestiona documentos inmueble" on public.inmueble_documentos;
create policy "Equipo gestiona documentos inmueble"
  on public.inmueble_documentos
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

-- Demandas.
drop policy if exists "Comercial lee demandas" on public.demandas;
drop policy if exists "Equipo lee demandas" on public.demandas;
create policy "Equipo lee demandas"
  on public.demandas
  for select
  using (public.is_equipo());

drop policy if exists "Comercial crea demandas" on public.demandas;
drop policy if exists "Equipo crea demandas" on public.demandas;
create policy "Equipo crea demandas"
  on public.demandas
  for insert
  with check (public.is_equipo());

drop policy if exists "Comercial actualiza demandas" on public.demandas;
drop policy if exists "Equipo actualiza demandas" on public.demandas;
create policy "Equipo actualiza demandas"
  on public.demandas
  for update
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Comercial borra sus demandas" on public.demandas;
drop policy if exists "Equipo borra demandas" on public.demandas;
create policy "Equipo borra demandas"
  on public.demandas
  for delete
  using (public.is_equipo());

-- Citas.
drop policy if exists "Comercial lee citas" on public.citas;
drop policy if exists "Equipo lee citas" on public.citas;
create policy "Equipo lee citas"
  on public.citas
  for select
  using (public.is_equipo());

drop policy if exists "Comercial crea citas del equipo" on public.citas;
drop policy if exists "Equipo crea citas" on public.citas;
create policy "Equipo crea citas"
  on public.citas
  for insert
  with check (public.is_equipo());

drop policy if exists "Comercial actualiza sus citas" on public.citas;
drop policy if exists "Equipo actualiza citas" on public.citas;
create policy "Equipo actualiza citas"
  on public.citas
  for update
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Comercial borra sus citas" on public.citas;
drop policy if exists "Equipo borra citas" on public.citas;
create policy "Equipo borra citas"
  on public.citas
  for delete
  using (public.is_equipo());

-- Tareas y su actividad.
drop policy if exists "Comercial lee tareas" on public.tareas;
drop policy if exists "Equipo lee tareas" on public.tareas;
create policy "Equipo lee tareas"
  on public.tareas
  for select
  using (public.is_equipo());

drop policy if exists "Comercial crea sus tareas" on public.tareas;
drop policy if exists "Equipo crea tareas" on public.tareas;
create policy "Equipo crea tareas"
  on public.tareas
  for insert
  with check (public.is_equipo() and creado_por = auth.uid());

drop policy if exists "Comercial actualiza sus tareas" on public.tareas;
drop policy if exists "Equipo actualiza tareas" on public.tareas;
create policy "Equipo actualiza tareas"
  on public.tareas
  for update
  using (public.is_equipo())
  with check (public.is_equipo());

drop policy if exists "Comercial borra sus tareas" on public.tareas;
drop policy if exists "Equipo borra tareas" on public.tareas;
create policy "Equipo borra tareas"
  on public.tareas
  for delete
  using (public.is_equipo());

drop policy if exists "Comercial lee actividad de sus tareas" on public.tareas_actividad;
drop policy if exists "Comercial escribe actividad de sus tareas" on public.tareas_actividad;
drop policy if exists "Comercial borra actividad de sus tareas" on public.tareas_actividad;
drop policy if exists "Equipo lee actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo escribe actividad de tareas" on public.tareas_actividad;
drop policy if exists "Equipo borra actividad de tareas" on public.tareas_actividad;

create policy "Equipo lee actividad de tareas"
  on public.tareas_actividad
  for select
  using (public.is_equipo());

create policy "Equipo escribe actividad de tareas"
  on public.tareas_actividad
  for insert
  with check (public.is_equipo());

create policy "Equipo borra actividad de tareas"
  on public.tareas_actividad
  for delete
  using (public.is_equipo());

-- Cruce demanda-inmueble.
drop policy if exists "Equipo lee matching demanda" on public.demanda_inmuebles;
drop policy if exists "Equipo escribe matching demanda" on public.demanda_inmuebles;
create policy "Equipo lee matching demanda"
  on public.demanda_inmuebles
  for select
  using (public.is_equipo());

create policy "Equipo escribe matching demanda"
  on public.demanda_inmuebles
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

-- El alta no depende de marcar al contacto. Si eso falla, queda aviso en el log.
create or replace function public.marcar_cliente_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  persona uuid;
  fila jsonb;
begin
  fila := to_jsonb(new);
  persona := case TG_TABLE_NAME
    when 'propiedades' then nullif(fila ->> 'ofertante_id', '')::uuid
    else nullif(fila ->> 'cliente_id', '')::uuid
  end;
  if persona is null then
    return new;
  end if;
  begin
    update public.clientes
    set es_cliente = true,
        updated_at = now()
    where id = persona
      and es_cliente is distinct from true;
  exception
    when others then
      raise warning 'marcar_cliente_vinculado: %', sqlerrm;
  end;
  return new;
end;
$$;
