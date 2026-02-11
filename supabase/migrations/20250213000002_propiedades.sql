-- Tabla propiedades (ofertantes = clientes con propiedades)
create table if not exists public.propiedades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ofertante_id uuid not null references public.clientes (id) on delete cascade,
  titulo text,
  direccion text,
  codigo_postal text,
  localidad text,
  tipo_operacion text not null default 'ambos' check (tipo_operacion in ('venta', 'alquiler', 'ambos')),
  precio_venta numeric(12, 2),
  precio_alquiler numeric(12, 2),
  superficie_m2 numeric(10, 2),
  habitaciones int,
  estado text not null default 'disponible' check (estado in ('disponible', 'reservada', 'vendida', 'alquilada', 'baja')),
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.propiedades is 'Propiedades inmobiliarias. ofertante_id = cliente propietario que las ofrece.';

alter table public.propiedades enable row level security;

create policy "Admin puede todo en propiedades"
  on public.propiedades for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Agente CRUD sus propiedades"
  on public.propiedades for all
  using (auth.uid() = user_id);

create index if not exists idx_propiedades_user_id on public.propiedades (user_id);
create index if not exists idx_propiedades_ofertante_id on public.propiedades (ofertante_id);
create index if not exists idx_propiedades_estado on public.propiedades (estado);
create index if not exists idx_propiedades_tipo_operacion on public.propiedades (tipo_operacion);
