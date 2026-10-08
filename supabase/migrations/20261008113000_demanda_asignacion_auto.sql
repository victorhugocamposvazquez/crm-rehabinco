alter table public.demandas
  add column if not exists asignacion_auto boolean not null default false;

alter table public.demandas
  add column if not exists asignacion_casi boolean not null default false;

comment on column public.demandas.asignacion_auto is
  'Si es cierto, un inmueble que encaja pasa directo a asignados.';

comment on column public.demandas.asignacion_casi is
  'Con asignación automática, incluye también los que casi encajan.';
