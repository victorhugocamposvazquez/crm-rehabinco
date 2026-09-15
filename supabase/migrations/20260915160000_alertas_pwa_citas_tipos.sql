create table if not exists public.crm_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_push_subs_user on public.crm_push_subs (user_id);

alter table public.crm_push_subs enable row level security;
revoke all on table public.crm_push_subs from anon, public;
grant select, insert, update, delete on table public.crm_push_subs to authenticated;

create policy "Usuario gestiona sus push"
  on public.crm_push_subs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.crm_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  clave text not null unique,
  titulo text not null,
  cuerpo text,
  url text,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_avisos_user on public.crm_avisos (user_id, leida, created_at desc);

alter table public.crm_avisos enable row level security;
revoke all on table public.crm_avisos from anon, public;
grant select, update on table public.crm_avisos to authenticated;

create policy "Usuario lee sus avisos"
  on public.crm_avisos for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuario marca avisos leídos"
  on public.crm_avisos for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.citas drop constraint if exists citas_tipo_check;
alter table public.citas add constraint citas_tipo_check
  check (tipo in ('visita', 'llamada', 'firma', 'evento', 'recordatorio', 'tarea', 'otro'));
