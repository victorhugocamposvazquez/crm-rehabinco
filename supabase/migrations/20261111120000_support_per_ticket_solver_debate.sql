-- Ajuste de soporte v3:
-- 1. Prioridad de ahorro de costes: modelo por defecto 'auto' en Cursor.
-- 2. Control a demanda por ticket: modelo propio por ticket y modo debate (Autor + Verificador).

alter table public.support_settings
  alter column cursor_model set default 'auto';

update public.support_settings
set cursor_model = 'auto'
where project_key = 'rehabinco';

alter table public.support_tickets
  add column if not exists cursor_model_override text
    check (cursor_model_override is null or cursor_model_override in ('auto', 'composer-2.5')),
  add column if not exists debate_mode boolean not null default false;

comment on column public.support_tickets.cursor_model_override is
  'Modelo específico elegido a demanda para este ticket (auto para máximo ahorro o composer-2.5).';

comment on column public.support_tickets.debate_mode is
  'Cuando es true, dos agentes debaten: uno propone/resuelve y un verificador independiente audita el diff antes del PR.';
