-- Asignación de una finca a un comercial para que haga las visitas
-- desde la Property. No crea visitas. No toca horizontalDivision.

create table if not exists public.catastro_explorer_assignments (
  finca_reference text primary key
    check (char_length(finca_reference) = 14),
  comercial_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now()
);

comment on table public.catastro_explorer_assignments is
  'Comercial asignado a una finca de Catastro Explorer. La visita se crea desde la Property, no desde aquí.';

create index if not exists idx_catastro_explorer_assignments_comercial
  on public.catastro_explorer_assignments (comercial_id);

alter table public.catastro_explorer_assignments enable row level security;

revoke all on table public.catastro_explorer_assignments from anon, public;
grant select, insert, update, delete on public.catastro_explorer_assignments to authenticated;

drop policy if exists "Equipo lee asignaciones catastro" on public.catastro_explorer_assignments;
create policy "Equipo lee asignaciones catastro"
  on public.catastro_explorer_assignments for select
  to authenticated
  using (public.is_admin() or public.is_agente());

drop policy if exists "Equipo crea asignaciones catastro" on public.catastro_explorer_assignments;
create policy "Equipo crea asignaciones catastro"
  on public.catastro_explorer_assignments for insert
  to authenticated
  with check (public.is_admin() or public.is_agente());

drop policy if exists "Equipo actualiza asignaciones catastro" on public.catastro_explorer_assignments;
create policy "Equipo actualiza asignaciones catastro"
  on public.catastro_explorer_assignments for update
  to authenticated
  using (public.is_admin() or public.is_agente())
  with check (public.is_admin() or public.is_agente());

drop policy if exists "Equipo borra asignaciones catastro" on public.catastro_explorer_assignments;
create policy "Equipo borra asignaciones catastro"
  on public.catastro_explorer_assignments for delete
  to authenticated
  using (public.is_admin() or public.is_agente());
