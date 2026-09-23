-- Recogidas de listado Idealista (Bright Data). Solo una recogida completa puede retirar anuncios.

create table if not exists public.captacion_recogidas (
  collection_id text primary key,
  zonas text[] not null default '{}',
  iniciada timestamptz not null default now(),
  completada timestamptz,
  registros integer not null default 0,
  externos text[] not null default '{}'
);

comment on table public.captacion_recogidas is
  'Una pasada de listado Idealista. completada solo cuando /dca/dataset devuelve el archivo entero.';

alter table public.captacion_recogidas enable row level security;
revoke all on table public.captacion_recogidas from anon, public, authenticated;
