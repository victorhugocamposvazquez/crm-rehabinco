-- Credenciales de APIs de portales. Solo service role (el CRM las lee/escribe
-- desde rutas de admin). Nunca vía anon/authenticated.

create table if not exists public.captacion_portales_credenciales (
  portal text primary key
    check (portal in ('idealista', 'fotocasa', 'milanuncios')),
  api_key text,
  api_secret text,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.captacion_portales_credenciales is
  'Claves de Search API. Dirección las gestiona en Ajustes; el sync las lee con service role.';

alter table public.captacion_portales_credenciales enable row level security;
revoke all on table public.captacion_portales_credenciales from anon, public, authenticated;
