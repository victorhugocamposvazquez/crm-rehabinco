-- Cláusulas personalizadas editadas en la previsualización del contrato de arras.

alter table public.contratos_arras
  add column if not exists clausulas_personalizadas jsonb not null default '{}'::jsonb;

comment on column public.contratos_arras.clausulas_personalizadas is
  'Texto de cláusulas editado a mano en la previsualización (clave → texto plano).';
