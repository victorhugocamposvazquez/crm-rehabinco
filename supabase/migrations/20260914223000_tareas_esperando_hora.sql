-- Tablero de tareas: bandeja Esperando, hora opcional y vínculo con la agenda.

alter table public.tareas
  drop constraint if exists tareas_estado_check;

alter table public.tareas
  add constraint tareas_estado_check
  check (estado in ('pendiente', 'esperando', 'hecha'));

alter table public.tareas
  add column if not exists hora time;

alter table public.citas
  add column if not exists tarea_id uuid references public.tareas (id) on delete set null;

create index if not exists idx_citas_tarea on public.citas (tarea_id);
