-- Encargo de captación: puede existir sin referencia catastral.
-- El admin lo crea (Catastro, alta manual o Excel). Quien lo tiene asignado lo continúa.

create table if not exists public.captacion_encargos (
  id uuid primary key default gen_random_uuid(),
  asignado_a uuid not null references public.profiles (id) on delete restrict,
  asignado_por uuid references public.profiles (id) on delete set null,
  origen text not null check (origen in ('catastro', 'manual', 'import')),
  finca_reference text unique
    check (finca_reference is null or char_length(finca_reference) = 14),
  calle text not null default '',
  numero text not null default '',
  municipio text not null default '',
  tipo_uso text,
  operacion text not null default 'por_confirmar'
    check (operacion in ('alquiler', 'venta', 'por_confirmar', 'no_aplica')),
  contacto_nombre text,
  telefono text,
  email text,
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
  resultado text,
  notas_revision text,
  requiere_confirmacion boolean not null default false,
  prioridad text check (prioridad is null or prioridad in ('alta', 'media', 'baja')),
  posible_duplicado boolean not null default false,
  fila_origen jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.captacion_encargos is
  'Trabajo de captación encargado a una persona. La referencia catastral se vincula cuando la dirección está clara.';

create index if not exists idx_captacion_encargos_asignado
  on public.captacion_encargos (asignado_a, updated_at desc);

create index if not exists idx_captacion_encargos_estado
  on public.captacion_encargos (estado);

create table if not exists public.captacion_encargo_actividad (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.captacion_encargos (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  tipo text not null
    check (tipo in ('estado', 'nota', 'llamada', 'visita', 'tarea', 'asignacion', 'cita', 'propiedad')),
  detalle text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.captacion_encargo_actividad is
  'Seguimiento del encargo: visita de puerta, llamada, nota o cambio de estado. No es un parte de visita.';

create index if not exists idx_captacion_encargo_actividad_encargo
  on public.captacion_encargo_actividad (encargo_id, created_at desc);

alter table public.captacion_encargos enable row level security;
alter table public.captacion_encargo_actividad enable row level security;

revoke all on table public.captacion_encargos from anon, public;
revoke all on table public.captacion_encargo_actividad from anon, public;
grant select, insert, update, delete on table public.captacion_encargos to authenticated;
grant select, insert on table public.captacion_encargo_actividad to authenticated;

drop policy if exists "Admin lee encargos captacion" on public.captacion_encargos;
create policy "Admin lee encargos captacion"
  on public.captacion_encargos for select
  to authenticated
  using (public.is_admin() or asignado_a = auth.uid() or asignado_por = auth.uid());

drop policy if exists "Gestor crea encargos captacion" on public.captacion_encargos;
create policy "Gestor crea encargos captacion"
  on public.captacion_encargos for insert
  to authenticated
  with check (public.is_admin() or (public.is_catastro_user() and asignado_por = auth.uid()));

drop policy if exists "Admin actualiza encargos captacion" on public.captacion_encargos;
create policy "Admin actualiza encargos captacion"
  on public.captacion_encargos for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Asignado continua su encargo" on public.captacion_encargos;
create policy "Asignado continua su encargo"
  on public.captacion_encargos for update
  to authenticated
  using (asignado_a = auth.uid())
  with check (asignado_a = auth.uid());

drop policy if exists "Admin borra encargos captacion" on public.captacion_encargos;
create policy "Admin borra encargos captacion"
  on public.captacion_encargos for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "Quien ve el encargo lee su actividad" on public.captacion_encargo_actividad;
create policy "Quien ve el encargo lee su actividad"
  on public.captacion_encargo_actividad for select
  to authenticated
  using (
    exists (
      select 1 from public.captacion_encargos e
      where e.id = captacion_encargo_actividad.encargo_id
        and (public.is_admin() or e.asignado_a = auth.uid() or e.asignado_por = auth.uid())
    )
  );

drop policy if exists "Asignado o admin anota el encargo" on public.captacion_encargo_actividad;
create policy "Asignado o admin anota el encargo"
  on public.captacion_encargo_actividad for insert
  to authenticated
  with check (
    exists (
      select 1 from public.captacion_encargos e
      where e.id = captacion_encargo_actividad.encargo_id
        and (public.is_admin() or e.asignado_a = auth.uid())
    )
  );

drop policy if exists "Catastro user lee pipeline de sus fincas" on public.catastro_explorer_pipeline;
create policy "Catastro user lee pipeline de sus fincas"
  on public.catastro_explorer_pipeline for select
  to authenticated
  using (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

drop policy if exists "Catastro user actualiza pipeline de sus fincas" on public.catastro_explorer_pipeline;
create policy "Catastro user actualiza pipeline de sus fincas"
  on public.catastro_explorer_pipeline for update
  to authenticated
  using (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  )
  with check (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

drop policy if exists "Catastro user crea pipeline de sus fincas" on public.catastro_explorer_pipeline;
create policy "Catastro user crea pipeline de sus fincas"
  on public.catastro_explorer_pipeline for insert
  to authenticated
  with check (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_pipeline.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

drop policy if exists "Catastro user lee actividad de sus fincas" on public.catastro_explorer_actividad;
create policy "Catastro user lee actividad de sus fincas"
  on public.catastro_explorer_actividad for select
  to authenticated
  using (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_actividad.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

drop policy if exists "Catastro user anota actividad de sus fincas" on public.catastro_explorer_actividad;
create policy "Catastro user anota actividad de sus fincas"
  on public.catastro_explorer_actividad for insert
  to authenticated
  with check (
    public.is_catastro_user()
    and exists (
      select 1 from public.catastro_explorer_assignments a
      where a.finca_reference = catastro_explorer_actividad.finca_reference
        and a.comercial_id = auth.uid()
    )
  );

alter table public.crm_aviso_prefs
  add column if not exists encargos boolean not null default true;

comment on column public.crm_aviso_prefs.encargos is
  'Aviso en la PWA y push cuando te encargan un portal nuevo.';

do $$
begin
  alter publication supabase_realtime add table public.crm_avisos;
exception
  when duplicate_object then null;
end $$;
