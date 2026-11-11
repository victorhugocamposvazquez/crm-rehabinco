-- Preferencia personal de correo para recibir alertas de tickets (lado cliente/usuario).

create table if not exists public.support_user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  alert_email text,
  notify_email boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.support_user_prefs is
  'Correo elegido por cada usuario para recibir las alertas de sus propios tickets de soporte.';

alter table public.support_user_prefs enable row level security;
revoke all on table public.support_user_prefs from anon, public;
grant select, insert, update on table public.support_user_prefs to authenticated;

drop policy if exists "Usuario gestiona su correo de soporte" on public.support_user_prefs;
create policy "Usuario gestiona su correo de soporte"
  on public.support_user_prefs for all
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());
