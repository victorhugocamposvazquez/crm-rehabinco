-- Hoja de encargo de venta en exclusiva (documento aparte del reconocimiento de honorarios).

create table if not exists public.hojas_encargo_exclusiva (
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
  plazo_meses numeric(6,2) not null default 6,
  precio_venta numeric(14,2),
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

comment on table public.hojas_encargo_exclusiva is
  'Hojas de encargo de venta en exclusiva (Rehabinco).';

create index if not exists idx_hojas_encargo_exclusiva_user
  on public.hojas_encargo_exclusiva (user_id, created_at desc);
create index if not exists idx_hojas_encargo_exclusiva_vivos
  on public.hojas_encargo_exclusiva (created_at desc)
  where deleted_at is null;

alter table public.hojas_encargo_exclusiva enable row level security;
revoke all on table public.hojas_encargo_exclusiva from anon, public;
grant select, insert, update, delete on table public.hojas_encargo_exclusiva to authenticated;

drop policy if exists "Admin puede todo en hojas_encargo_exclusiva" on public.hojas_encargo_exclusiva;
create policy "Admin puede todo en hojas_encargo_exclusiva"
  on public.hojas_encargo_exclusiva for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Agente CRUD sus hojas_encargo_exclusiva" on public.hojas_encargo_exclusiva;
create policy "Agente CRUD sus hojas_encargo_exclusiva"
  on public.hojas_encargo_exclusiva for all
  to authenticated
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());

drop trigger if exists trg_omitir_clausulas_conchado on public.hojas_encargo_exclusiva;
create trigger trg_omitir_clausulas_conchado
  before insert or update of clausulas_personalizadas
  on public.hojas_encargo_exclusiva
  for each row execute function public.tg_omitir_clausulas_conchado();

alter table public.papelera_items
  drop constraint if exists papelera_items_tipo_check;

alter table public.papelera_items
  add constraint papelera_items_tipo_check
  check (tipo in (
    'parte_visita',
    'contrato_arras',
    'hoja_encargo_honorarios',
    'hoja_encargo_exclusiva',
    'contrato_pago_aplazado',
    'contrato_arrendamiento',
    'usuario'
  ));
