-- Partes de visita con enlace público de firma
create table if not exists public.partes_visita (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  estado text not null default 'pendiente_firma'
    check (estado in ('borrador', 'pendiente_firma', 'firmado')),

  visitante_nombre text,
  visitante_documento text,
  visitante_telefono text,
  visitante_email text,

  inmueble_direccion text,
  inmueble_referencia text,
  fecha_visita date,
  hora_visita time,
  agente_nombre text,

  observaciones text,
  lugar_firma text not null default 'A Coruña',

  firma_visitante text,
  firma_agente text,
  firmado_en timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.partes_visita is 'Partes de visita inmobiliaria con firma pública por token.';

alter table public.partes_visita enable row level security;

create policy "Admin puede todo en partes_visita"
  on public.partes_visita for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Agente CRUD sus partes_visita"
  on public.partes_visita for all
  using (auth.uid() = user_id);

create index if not exists idx_partes_visita_user_id on public.partes_visita (user_id);
create index if not exists idx_partes_visita_propiedad_id on public.partes_visita (propiedad_id);
create index if not exists idx_partes_visita_estado on public.partes_visita (estado);
create index if not exists idx_partes_visita_token on public.partes_visita (token);
create index if not exists idx_partes_visita_fecha on public.partes_visita (fecha_visita desc);
