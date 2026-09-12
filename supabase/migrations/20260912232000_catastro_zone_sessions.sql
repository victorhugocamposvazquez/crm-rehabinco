-- Sesiones de búsqueda por zona. Permiten continuar entre isolates de Vercel.
-- No toca tablas del CRM interno.

create table if not exists public.catastro_zone_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  clave_zona text not null,
  status text not null
    check (status in ('prepared', 'running', 'paused', 'cancelled', 'upstream_paused', 'done')),
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clave_zona)
);

comment on table public.catastro_zone_sessions is
  'Sesión operativa de una búsqueda por zona (bloque de calles). Privada por usuario. Caduca.';

create index if not exists idx_catastro_zone_sessions_user_expires
  on public.catastro_zone_sessions (user_id, expires_at);

alter table public.catastro_zone_sessions enable row level security;

drop policy if exists "Usuario lee sus sesiones zona catastro" on public.catastro_zone_sessions;
create policy "Usuario lee sus sesiones zona catastro"
  on public.catastro_zone_sessions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuario crea sus sesiones zona catastro" on public.catastro_zone_sessions;
create policy "Usuario crea sus sesiones zona catastro"
  on public.catastro_zone_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuario actualiza sus sesiones zona catastro" on public.catastro_zone_sessions;
create policy "Usuario actualiza sus sesiones zona catastro"
  on public.catastro_zone_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuario borra sus sesiones zona catastro" on public.catastro_zone_sessions;
create policy "Usuario borra sus sesiones zona catastro"
  on public.catastro_zone_sessions for delete
  to authenticated
  using (auth.uid() = user_id);
