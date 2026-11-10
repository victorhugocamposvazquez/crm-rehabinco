-- Zonas que cerraron una pasada incompleta (tope pág. 60): priorizar en el siguiente trigger.
alter table public.captacion_brightdata_zonas
  add column if not exists reintento_prioridad boolean not null default false;

comment on column public.captacion_brightdata_zonas.reintento_prioridad is
  'True si la última pasada diaria no leyó la zona entera; el trigger las encola primero.';
