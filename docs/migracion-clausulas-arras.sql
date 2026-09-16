alter table public.contratos_arras
  add column if not exists clausulas_personalizadas jsonb not null default '{}'::jsonb;
