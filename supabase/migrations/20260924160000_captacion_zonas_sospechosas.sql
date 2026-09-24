alter table public.captacion_recogidas
  add column if not exists conteos jsonb not null default '{}'::jsonb,
  add column if not exists sospechosas jsonb not null default '{}'::jsonb;
