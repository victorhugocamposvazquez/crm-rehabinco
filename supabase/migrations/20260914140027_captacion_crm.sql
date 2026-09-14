-- Programa de captación: pipeline, actividad, tareas, citas, demandas y matching.
-- No toca el motor DH ni catastro_fincas.

-- ---------------------------------------------------------------------------
-- 1. Pipeline por finca asignada
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_explorer_pipeline (
  finca_reference text primary key
    references public.catastro_explorer_assignments (finca_reference) on delete cascade,
  estado text not null default 'nueva'
    check (estado in (
      'nueva',
      'contactar',
      'propietario_localizado',
      'visita',
      'mandato',
      'en_stock',
      'descartada',
      'no_localizable'
    )),
  proxima_accion text,
  proxima_accion_en date,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.catastro_explorer_pipeline is
  'Estado comercial de captación. Independiente de DH y del estado de stock del inmueble.';

create index if not exists idx_catastro_pipeline_estado
  on public.catastro_explorer_pipeline (estado);

create index if not exists idx_catastro_pipeline_proxima
  on public.catastro_explorer_pipeline (proxima_accion_en);

alter table public.catastro_explorer_pipeline enable row level security;
revoke all on table public.catastro_explorer_pipeline from anon, public;
grant select, insert, update on table public.catastro_explorer_pipeline to authenticated;

create policy "Admin lee pipeline captacion"
  on public.catastro_explorer_pipeline for select
  to authenticated
  using (public.is_admin());

create policy "Comercial lee pipeline de sus fincas"
  on public.catastro_explorer_pipeline for select
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

create policy "Admin escribe pipeline captacion"
  on public.catastro_explorer_pipeline for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial actualiza pipeline de sus fincas"
  on public.catastro_explorer_pipeline for update
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  )
  with check (
    public.is_agente()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

create policy "Comercial crea pipeline de sus fincas"
  on public.catastro_explorer_pipeline for insert
  to authenticated
  with check (
    public.is_agente()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Actividad / timeline
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_explorer_actividad (
  id uuid primary key default gen_random_uuid(),
  finca_reference text not null,
  actor_id uuid references auth.users (id) on delete set null,
  tipo text not null
    check (tipo in ('estado', 'nota', 'llamada', 'tarea', 'asignacion', 'cita', 'propiedad')),
  detalle text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.catastro_explorer_actividad is
  'Historial de captación por finca: cambios de estado, notas, llamadas, tareas, citas.';

create index if not exists idx_catastro_actividad_finca
  on public.catastro_explorer_actividad (finca_reference, created_at desc);

alter table public.catastro_explorer_actividad enable row level security;
revoke all on table public.catastro_explorer_actividad from anon, public;
grant select, insert on table public.catastro_explorer_actividad to authenticated;

create policy "Equipo lee actividad captacion"
  on public.catastro_explorer_actividad for select
  to authenticated
  using (
    public.is_admin()
    or (
      public.is_agente()
      and exists (
        select 1 from public.catastro_explorer_assignments a
        where a.finca_reference = catastro_explorer_actividad.finca_reference
          and a.comercial_id = auth.uid()
      )
    )
  );

create policy "Equipo escribe actividad captacion"
  on public.catastro_explorer_actividad for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.is_agente()
      and exists (
        select 1 from public.catastro_explorer_assignments a
        where a.finca_reference = catastro_explorer_actividad.finca_reference
          and a.comercial_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Demandas y matching
-- ---------------------------------------------------------------------------

create table if not exists public.demandas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  comercial_id uuid not null references public.profiles (id) on delete restrict,
  tipo_operacion text not null default 'compra'
    check (tipo_operacion in ('compra', 'alquiler', 'ambos')),
  tipos_inmueble text[] not null default '{}',
  zonas text[] not null default '{}',
  presupuesto_min numeric,
  presupuesto_max numeric,
  superficie_min numeric,
  superficie_max numeric,
  habitaciones_min integer,
  banos_min integer,
  requisitos text,
  estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'cubierta', 'cerrada')),
  origen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.demandas is
  'Cliente que busca un tipo de inmueble. Independiente del ofertante.';

create index if not exists idx_demandas_cliente on public.demandas (cliente_id);
create index if not exists idx_demandas_comercial on public.demandas (comercial_id);
create index if not exists idx_demandas_estado on public.demandas (estado);

alter table public.demandas enable row level security;
revoke all on table public.demandas from anon, public;
grant select, insert, update, delete on table public.demandas to authenticated;

create policy "Admin gestiona demandas"
  on public.demandas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial lee demandas"
  on public.demandas for select
  to authenticated
  using (public.is_agente());

create policy "Comercial crea demandas propias"
  on public.demandas for insert
  to authenticated
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial actualiza sus demandas"
  on public.demandas for update
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid())
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial borra sus demandas"
  on public.demandas for delete
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());

create table if not exists public.demanda_inmuebles (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas (id) on delete cascade,
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  origen text not null default 'automatico'
    check (origen in ('automatico', 'manual')),
  puntuacion numeric not null default 0,
  estado text not null default 'propuesto'
    check (estado in ('propuesto', 'presentado', 'descartado', 'visitado', 'oferta')),
  notas text,
  created_at timestamptz not null default now(),
  unique (demanda_id, propiedad_id)
);

comment on table public.demanda_inmuebles is
  'Cruce demanda ↔ inmueble. El comercial confirma o descarta; no se envía nada solo.';

create index if not exists idx_demanda_inmuebles_propiedad
  on public.demanda_inmuebles (propiedad_id);

alter table public.demanda_inmuebles enable row level security;
revoke all on table public.demanda_inmuebles from anon, public;
grant select, insert, update, delete on table public.demanda_inmuebles to authenticated;

create policy "Equipo lee matching demanda"
  on public.demanda_inmuebles for select
  to authenticated
  using (public.is_admin() or public.is_agente());

create policy "Equipo escribe matching demanda"
  on public.demanda_inmuebles for all
  to authenticated
  using (public.is_admin() or public.is_agente())
  with check (public.is_admin() or public.is_agente());

-- ---------------------------------------------------------------------------
-- 4. Citas y tareas
-- ---------------------------------------------------------------------------

create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  comercial_id uuid not null references public.profiles (id) on delete restrict,
  tipo text not null default 'visita'
    check (tipo in ('visita', 'llamada', 'firma', 'otro')),
  titulo text not null,
  empieza timestamptz not null,
  termina timestamptz not null,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  demanda_id uuid references public.demandas (id) on delete set null,
  finca_reference text,
  estado text not null default 'prevista'
    check (estado in ('prevista', 'hecha', 'no_asistio', 'cancelada')),
  created_at timestamptz not null default now()
);

comment on table public.citas is
  'Agenda. Distinta del parte de visita (acta firmada).';

create index if not exists idx_citas_comercial_empieza on public.citas (comercial_id, empieza);
create index if not exists idx_citas_propiedad on public.citas (propiedad_id);

alter table public.citas enable row level security;
revoke all on table public.citas from anon, public;
grant select, insert, update, delete on table public.citas to authenticated;

create policy "Admin gestiona citas"
  on public.citas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial lee citas"
  on public.citas for select
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial crea sus citas"
  on public.citas for insert
  to authenticated
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial actualiza sus citas"
  on public.citas for update
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid())
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial borra sus citas"
  on public.citas for delete
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());

alter table public.partes_visita
  add column if not exists cita_id uuid references public.citas (id) on delete set null;

create index if not exists idx_partes_visita_cita on public.partes_visita (cita_id);

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  comercial_id uuid not null references public.profiles (id) on delete restrict,
  titulo text not null,
  vence date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'hecha')),
  finca_reference text,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  demanda_id uuid references public.demandas (id) on delete set null,
  cita_id uuid references public.citas (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.tareas is
  'Follow-up del comercial: llamar, visitar, revisar. Semilla de la pantalla Hoy.';

create index if not exists idx_tareas_comercial_vence on public.tareas (comercial_id, vence);
create index if not exists idx_tareas_finca on public.tareas (finca_reference);

alter table public.tareas enable row level security;
revoke all on table public.tareas from anon, public;
grant select, insert, update, delete on table public.tareas to authenticated;

create policy "Admin gestiona tareas"
  on public.tareas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial lee tareas"
  on public.tareas for select
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial crea sus tareas"
  on public.tareas for insert
  to authenticated
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial actualiza sus tareas"
  on public.tareas for update
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid())
  with check (public.is_agente() and comercial_id = auth.uid());

create policy "Comercial borra sus tareas"
  on public.tareas for delete
  to authenticated
  using (public.is_agente() and comercial_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Triggers de asignación → pipeline + actividad
-- ---------------------------------------------------------------------------

create or replace function public.trg_captacion_al_asignar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.catastro_explorer_pipeline (finca_reference, estado, updated_by)
  values (new.finca_reference, 'nueva', new.assigned_by)
  on conflict (finca_reference) do nothing;

  insert into public.catastro_explorer_actividad (finca_reference, actor_id, tipo, detalle, payload)
  values (
    new.finca_reference,
    coalesce(new.assigned_by, auth.uid()),
    'asignacion',
    'Finca asignada',
    jsonb_build_object('comercialId', new.comercial_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_captacion_al_asignar on public.catastro_explorer_assignments;
create trigger trg_captacion_al_asignar
  after insert on public.catastro_explorer_assignments
  for each row execute function public.trg_captacion_al_asignar();

create or replace function public.trg_captacion_al_reasignar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.comercial_id is distinct from new.comercial_id then
    insert into public.catastro_explorer_actividad (finca_reference, actor_id, tipo, detalle, payload)
    values (
      new.finca_reference,
      coalesce(new.assigned_by, auth.uid()),
      'asignacion',
      'Finca reasignada',
      jsonb_build_object('comercialId', new.comercial_id, 'anterior', old.comercial_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_captacion_al_reasignar on public.catastro_explorer_assignments;
create trigger trg_captacion_al_reasignar
  after update of comercial_id on public.catastro_explorer_assignments
  for each row execute function public.trg_captacion_al_reasignar();

insert into public.catastro_explorer_pipeline (finca_reference, estado)
select a.finca_reference, 'nueva'
from public.catastro_explorer_assignments a
on conflict (finca_reference) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Alta desde Catastro sin ofertante obligatorio
-- ---------------------------------------------------------------------------

create or replace function public.crear_propiedad_desde_catastro(
  p_finca_reference text,
  p_titulo text,
  p_direccion text,
  p_codigo_postal text,
  p_localidad text,
  p_superficie_parcela numeric,
  p_ofertante_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;
  v_created boolean := false;
  v_ofertante uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not (public.is_admin() or public.is_agente()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_finca_reference is null or char_length(p_finca_reference) <> 14 then
    raise exception 'FINCA_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.catastro_fincas where finca_reference = p_finca_reference
  ) then
    raise exception 'FINCA_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_ofertante_id is not null and not exists (
    select 1 from public.clientes where id = p_ofertante_id
  ) then
    raise exception 'OFERTANTE_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('catastro_property:' || p_finca_reference));

  select property_id into v_property_id
  from public.catastro_property_links
  where finca_reference = p_finca_reference;
  if v_property_id is not null then
    return jsonb_build_object(
      'propertyId', v_property_id,
      'created', false,
      'fincaReference', p_finca_reference
    );
  end if;

  select id, ofertante_id into v_property_id, v_ofertante
  from public.propiedades
  where referencia_catastral = p_finca_reference
  order by created_at
  limit 1;

  if v_property_id is null then
    insert into public.propiedades (
      user_id,
      comercial_id,
      ofertante_id,
      titulo,
      direccion,
      codigo_postal,
      localidad,
      superficie_parcela,
      referencia_catastral,
      tipo_operacion,
      estado,
      origen,
      catastro_linked_at
    ) values (
      auth.uid(),
      auth.uid(),
      p_ofertante_id,
      nullif(trim(coalesce(p_titulo, '')), ''),
      nullif(trim(coalesce(p_direccion, '')), ''),
      nullif(trim(coalesce(p_codigo_postal, '')), ''),
      nullif(trim(coalesce(p_localidad, '')), ''),
      p_superficie_parcela,
      p_finca_reference,
      'ambos',
      'disponible',
      'CATASTRO_EXPLORER',
      now()
    )
    returning id into v_property_id;
    v_created := true;
  else
    update public.propiedades
    set
      origen = 'CATASTRO_EXPLORER',
      catastro_linked_at = coalesce(catastro_linked_at, now()),
      referencia_catastral = coalesce(referencia_catastral, p_finca_reference),
      ofertante_id = coalesce(ofertante_id, p_ofertante_id)
    where id = v_property_id;
  end if;

  insert into public.catastro_property_links (
    finca_reference,
    property_id,
    linked_by,
    linked_at,
    source
  ) values (
    p_finca_reference,
    v_property_id,
    auth.uid(),
    now(),
    'CATASTRO_EXPLORER'
  );

  insert into public.catastro_explorer_actividad (finca_reference, actor_id, tipo, detalle, payload)
  values (
    p_finca_reference,
    auth.uid(),
    'propiedad',
    case when v_created then 'Propiedad creada' else 'Propiedad vinculada' end,
    jsonb_build_object('propertyId', v_property_id)
  );

  update public.catastro_explorer_pipeline
  set estado = 'en_stock', updated_by = auth.uid(), updated_at = now()
  where finca_reference = p_finca_reference
    and estado not in ('descartada', 'no_localizable', 'en_stock');

  return jsonb_build_object(
    'propertyId', v_property_id,
    'created', v_created,
    'fincaReference', p_finca_reference
  );
exception
  when unique_violation then
    select property_id into v_property_id
    from public.catastro_property_links
    where finca_reference = p_finca_reference;
    if v_property_id is null then
      raise;
    end if;
    return jsonb_build_object(
      'propertyId', v_property_id,
      'created', false,
      'fincaReference', p_finca_reference
    );
end;
$$;
