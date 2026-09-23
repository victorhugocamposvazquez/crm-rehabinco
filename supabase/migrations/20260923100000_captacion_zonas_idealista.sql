-- Zonas de Idealista que el superadmin marca para la recogida de Bright Data.

create table if not exists public.captacion_brightdata_zonas (
  id text primary key,
  activa boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.captacion_brightdata_zonas is
  'Zonas de venta de Idealista activas para el disparo de Bright Data. El catálogo de URLs vive en el código.';

insert into public.captacion_brightdata_zonas (id, activa)
values
  ('coruna', true),
  ('oleiros', true),
  ('arteixo', true),
  ('culleredo', true),
  ('sada', true),
  ('bergondo', true),
  ('cambre', true),
  ('carral', true),
  ('abegondo', true),
  ('santiago', true),
  ('ferrol', true),
  ('naron', true),
  ('ribeira', true),
  ('boiro', true)
on conflict (id) do nothing;

alter table public.captacion_brightdata_zonas enable row level security;
revoke all on table public.captacion_brightdata_zonas from anon, public, authenticated;
