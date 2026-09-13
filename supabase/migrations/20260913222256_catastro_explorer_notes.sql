-- Notas comerciales del equipo sobre una finca.
-- No forman parte del snapshot de Catastro ni cambian horizontalDivision.
-- Sin FK a catastro_fincas: se pueden anotar fincas de un rastreo en curso.

create table if not exists public.catastro_explorer_notes (
  finca_reference text primary key
    check (char_length(finca_reference) = 14),
  notes text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.catastro_explorer_notes is
  'Notas comerciales compartidas de una finca de Catastro Explorer. Independientes del snapshot oficial.';

alter table public.catastro_explorer_notes enable row level security;

revoke all on table public.catastro_explorer_notes from anon, public;
grant select, insert, update, delete on table public.catastro_explorer_notes to authenticated;

drop policy if exists "Autenticado lee notas catastro" on public.catastro_explorer_notes;
create policy "Autenticado lee notas catastro"
  on public.catastro_explorer_notes for select
  to authenticated
  using (true);

drop policy if exists "Autenticado inserta notas catastro" on public.catastro_explorer_notes;
create policy "Autenticado inserta notas catastro"
  on public.catastro_explorer_notes for insert
  to authenticated
  with check (true);

drop policy if exists "Autenticado actualiza notas catastro" on public.catastro_explorer_notes;
create policy "Autenticado actualiza notas catastro"
  on public.catastro_explorer_notes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Autenticado borra notas catastro" on public.catastro_explorer_notes;
create policy "Autenticado borra notas catastro"
  on public.catastro_explorer_notes for delete
  to authenticated
  using (true);
