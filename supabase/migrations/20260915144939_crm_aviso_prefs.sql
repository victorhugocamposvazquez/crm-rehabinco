create table if not exists public.crm_aviso_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  visitas boolean not null default true,
  agenda boolean not null default true,
  tareas_hoy boolean not null default true,
  tareas_vencidas boolean not null default true,
  partes boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.crm_aviso_prefs enable row level security;
revoke all on table public.crm_aviso_prefs from anon, public;
grant select, insert, update on table public.crm_aviso_prefs to authenticated;

create policy "Usuario lee sus prefs de avisos"
  on public.crm_aviso_prefs for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuario escribe sus prefs de avisos"
  on public.crm_aviso_prefs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Usuario actualiza sus prefs de avisos"
  on public.crm_aviso_prefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
