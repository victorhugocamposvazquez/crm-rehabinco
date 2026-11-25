-- Notas simples del Registro de la Propiedad: pedidos, estado, PDF y resumen leído.
-- El PDF va al bucket privado inmueble-docs (notas-simples/<id>.pdf) y, si la nota
-- está vinculada a un inmueble, también como documento del inmueble (tipo nota_simple).

create table if not exists public.notas_simples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  propiedad_id uuid references public.propiedades (id) on delete set null,
  ref_catastral text check (ref_catastral is null or ref_catastral ~ '^[0-9A-Z]{14}([0-9A-Z]{6})?$'),
  idufir text check (idufir is null or idufir ~ '^[0-9]{14}$'),
  finca_registral text,
  registro text,
  direccion text not null,
  municipio text,
  provincia text,
  titular text,
  motivo text not null check (motivo in ('compraventa', 'arrendamiento', 'tasacion', 'encargo', 'otro')),
  motivo_texto text,
  estado text not null default 'solicitada'
    check (estado in ('borrador', 'solicitada', 'en_tramite', 'recibida', 'leida', 'cancelada', 'error')),
  proveedor text not null default 'manual' check (proveedor in ('manual', 'api')),
  proveedor_ref text,
  coste_cents integer,
  incidencia text,
  pdf_path text,
  documento_id uuid references public.inmueble_documentos (id) on delete set null,
  resumen jsonb,
  resumen_modelo text,
  solicitada_en timestamptz not null default now(),
  recibida_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notas_simples is
  'Pedidos de nota simple (Registro de la Propiedad): estado, PDF en inmueble-docs y resumen extraído.';

create index if not exists notas_simples_creadas_idx on public.notas_simples (created_at desc);
create index if not exists notas_simples_finca_idx on public.notas_simples (left(ref_catastral, 14));
create index if not exists notas_simples_idufir_idx on public.notas_simples (idufir) where idufir is not null;
create index if not exists notas_simples_propiedad_idx on public.notas_simples (propiedad_id) where propiedad_id is not null;

alter table public.notas_simples enable row level security;
revoke all on table public.notas_simples from anon, public;
grant select, insert, update on table public.notas_simples to authenticated;

-- El equipo comparte las notas (una nota pedida sirve a todos y evita pagarla dos veces).
drop policy if exists "Equipo lee notas simples" on public.notas_simples;
create policy "Equipo lee notas simples"
  on public.notas_simples for select to authenticated
  using (public.is_agente() or public.is_admin());

drop policy if exists "Equipo pide notas simples" on public.notas_simples;
create policy "Equipo pide notas simples"
  on public.notas_simples for insert to authenticated
  with check ((public.is_agente() or public.is_admin()) and user_id = auth.uid());

drop policy if exists "Equipo tramita notas simples" on public.notas_simples;
create policy "Equipo tramita notas simples"
  on public.notas_simples for update to authenticated
  using (public.is_agente() or public.is_admin())
  with check (public.is_agente() or public.is_admin());
