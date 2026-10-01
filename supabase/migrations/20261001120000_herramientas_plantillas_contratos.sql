-- Plantillas Herramientas: honorarios, compraventa aplazada y arrendamiento.

create table if not exists public.hojas_encargo_honorarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  comercial_id uuid references public.profiles (id) on delete set null,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'cerrado')),
  lugar text not null default 'A Coruña',
  fecha date,
  cliente_nombre text,
  cliente_dni text,
  cliente_calidad text,
  inmueble_descripcion text,
  honorarios_porcentaje numeric(6,2) not null default 3,
  honorarios_minimo numeric(14,2) not null default 3000,
  reparto_propiedad_pct numeric(6,2) not null default 60,
  reparto_agencia_pct numeric(6,2) not null default 40,
  clausulas_personalizadas jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hojas_encargo_honorarios is
  'Hojas de encargo / reconocimiento de honorarios (Rehabinco).';

create index if not exists idx_hojas_encargo_user on public.hojas_encargo_honorarios (user_id, created_at desc);
create index if not exists idx_hojas_encargo_vivos on public.hojas_encargo_honorarios (created_at desc)
  where deleted_at is null;

alter table public.hojas_encargo_honorarios enable row level security;
revoke all on table public.hojas_encargo_honorarios from anon, public;
grant select, insert, update, delete on table public.hojas_encargo_honorarios to authenticated;

drop policy if exists "Admin puede todo en hojas_encargo_honorarios" on public.hojas_encargo_honorarios;
create policy "Admin puede todo en hojas_encargo_honorarios"
  on public.hojas_encargo_honorarios for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Agente CRUD sus hojas_encargo_honorarios" on public.hojas_encargo_honorarios;
create policy "Agente CRUD sus hojas_encargo_honorarios"
  on public.hojas_encargo_honorarios for all
  to authenticated
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

create table if not exists public.contratos_pago_aplazado (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  comercial_id uuid references public.profiles (id) on delete set null,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'cerrado')),
  lugar text not null default 'A Coruña',
  fecha date,
  vendedores jsonb not null default '[]'::jsonb,
  compradores jsonb not null default '[]'::jsonb,
  finca_descripcion text,
  titulo_adquisicion text,
  precio numeric(14,2),
  pago_inicial numeric(14,2),
  cuota_mensual numeric(14,2),
  cuota_desde text,
  cuenta_vendedora text,
  plazo_escritura text,
  plazo_posesion text,
  penalizacion_mensual numeric(14,2),
  clausulas_personalizadas jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contratos_pago_aplazado is
  'Compraventa con pago aplazado generada desde Herramientas.';

create index if not exists idx_pago_aplazado_user on public.contratos_pago_aplazado (user_id, created_at desc);
create index if not exists idx_pago_aplazado_vivos on public.contratos_pago_aplazado (created_at desc)
  where deleted_at is null;

alter table public.contratos_pago_aplazado enable row level security;
revoke all on table public.contratos_pago_aplazado from anon, public;
grant select, insert, update, delete on table public.contratos_pago_aplazado to authenticated;

drop policy if exists "Admin puede todo en contratos_pago_aplazado" on public.contratos_pago_aplazado;
create policy "Admin puede todo en contratos_pago_aplazado"
  on public.contratos_pago_aplazado for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Agente CRUD sus contratos_pago_aplazado" on public.contratos_pago_aplazado;
create policy "Agente CRUD sus contratos_pago_aplazado"
  on public.contratos_pago_aplazado for all
  to authenticated
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

create table if not exists public.contratos_arrendamiento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  comercial_id uuid references public.profiles (id) on delete set null,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'cerrado')),
  lugar text not null default 'A Coruña',
  fecha date,
  arrendadores jsonb not null default '[]'::jsonb,
  arrendatarios jsonb not null default '[]'::jsonb,
  vivienda_direccion text,
  referencia_catastral text,
  fecha_inicio date,
  fecha_fin date,
  renta_anual numeric(14,2),
  renta_mensual numeric(14,2),
  cuenta_arrendadora text,
  fianza numeric(14,2),
  renta_periodo_texto text,
  seguro_importe numeric(14,2),
  clausulas_personalizadas jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contratos_arrendamiento is
  'Contratos de arrendamiento de vivienda (seguro DAS/COSNOR) desde Herramientas.';

create index if not exists idx_arrendamiento_user on public.contratos_arrendamiento (user_id, created_at desc);
create index if not exists idx_arrendamiento_vivos on public.contratos_arrendamiento (created_at desc)
  where deleted_at is null;

alter table public.contratos_arrendamiento enable row level security;
revoke all on table public.contratos_arrendamiento from anon, public;
grant select, insert, update, delete on table public.contratos_arrendamiento to authenticated;

drop policy if exists "Admin puede todo en contratos_arrendamiento" on public.contratos_arrendamiento;
create policy "Admin puede todo en contratos_arrendamiento"
  on public.contratos_arrendamiento for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Agente CRUD sus contratos_arrendamiento" on public.contratos_arrendamiento;
create policy "Agente CRUD sus contratos_arrendamiento"
  on public.contratos_arrendamiento for all
  to authenticated
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

alter table public.papelera_items
  drop constraint if exists papelera_items_tipo_check;

alter table public.papelera_items
  add constraint papelera_items_tipo_check
  check (tipo in (
    'parte_visita',
    'contrato_arras',
    'hoja_encargo_honorarios',
    'contrato_pago_aplazado',
    'contrato_arrendamiento',
    'usuario'
  ));
