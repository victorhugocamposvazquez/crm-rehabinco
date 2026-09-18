-- Papelera del superadmin + soft delete documentos + clientes extra en citas.

create table if not exists public.papelera_items (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('parte_visita', 'contrato_arras', 'usuario')),
  accion text not null check (accion in ('eliminar', 'crear')),
  entity_id uuid,
  etiqueta text not null,
  snapshot jsonb not null default '{}'::jsonb,
  solicitado_por uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  resuelto_por uuid references public.profiles (id) on delete set null,
  resolucion text check (resolucion is null or resolucion in ('aprobado', 'rechazado', 'restaurado'))
);

comment on table public.papelera_items is
  'Cola de aprobación del superadmin: borrados y altas de usuarios hechos por admins.';

create index if not exists idx_papelera_pendiente on public.papelera_items (created_at desc)
  where resuelto_at is null;

alter table public.partes_visita
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

alter table public.contratos_arras
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_partes_visita_vivos on public.partes_visita (created_at desc)
  where deleted_at is null;

create index if not exists idx_contratos_arras_vivos on public.contratos_arras (created_at desc)
  where deleted_at is null;

alter table public.citas
  add column if not exists clientes_extra_ids uuid[] not null default '{}';

update public.citas
set clientes_extra_ids = array[cliente2_id]
where cliente2_id is not null
  and (clientes_extra_ids is null or clientes_extra_ids = '{}');

alter table public.citas drop column if exists cliente2_id;

alter table public.papelera_items enable row level security;
revoke all on table public.papelera_items from anon, public;
grant select, insert, update on table public.papelera_items to authenticated;

create policy "Superadmin gestiona papelera"
  on public.papelera_items for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "Admin encola en papelera"
  on public.papelera_items for insert
  to authenticated
  with check (public.is_admin() and solicitado_por = auth.uid());

create policy "Admin lee sus solicitudes"
  on public.papelera_items for select
  to authenticated
  using (public.is_admin() and solicitado_por = auth.uid());
