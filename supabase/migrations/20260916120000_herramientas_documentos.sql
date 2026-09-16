-- Herramientas: PDF de partes de visita (cuartilla) y contratos de arras.

alter table public.partes_visita
  add column if not exists hora_fin time,
  add column if not exists calidad text not null default 'comprador';

alter table public.partes_visita
  drop constraint if exists partes_visita_calidad_check;

alter table public.partes_visita
  add constraint partes_visita_calidad_check
  check (calidad in ('comprador', 'arrendatario'));

comment on column public.partes_visita.hora_fin is 'Fin de la franja horaria del parte (cuartilla).';
comment on column public.partes_visita.calidad is 'comprador o arrendatario, según la plantilla de visita.';

create table if not exists public.contratos_arras (
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
  finca_anejos text,
  registro_libro text,
  registro_folio text,
  registro_finca text,
  registro_numero text,
  precio numeric(14,2),
  arras numeric(14,2),
  cuenta_vendedora text,
  plazo_escritura_dias integer,
  incluye_anejos boolean not null default false,
  hay_hipoteca boolean not null default false,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contratos_arras is
  'Contratos de arras generados desde el CRM. Histórico + PDF con datos de Rehabinco.';

create index if not exists idx_contratos_arras_user on public.contratos_arras (user_id, created_at desc);
create index if not exists idx_contratos_arras_fecha on public.contratos_arras (fecha desc);
create index if not exists idx_contratos_arras_propiedad on public.contratos_arras (propiedad_id);

alter table public.contratos_arras enable row level security;
revoke all on table public.contratos_arras from anon, public;
grant select, insert, update, delete on table public.contratos_arras to authenticated;

drop policy if exists "Admin puede todo en contratos_arras" on public.contratos_arras;
create policy "Admin puede todo en contratos_arras"
  on public.contratos_arras for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Agente CRUD sus contratos_arras" on public.contratos_arras;
create policy "Agente CRUD sus contratos_arras"
  on public.contratos_arras for all
  to authenticated
  using (auth.uid() = user_id and public.is_agente())
  with check (auth.uid() = user_id and public.is_agente());
