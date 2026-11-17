-- Token de Instagram de la agencia. Solo lo lee el servidor (service role): no hay políticas para el cliente.

create table if not exists public.instagram_conexion (
  id text primary key,
  ig_user_id text not null,
  username text not null,
  access_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.instagram_conexion enable row level security;

revoke all on public.instagram_conexion from anon, authenticated;
