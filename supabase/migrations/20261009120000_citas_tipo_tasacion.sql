-- Tasación es un tipo de entrada, igual que firma: calendario y tablero de tareas.

alter table public.citas drop constraint if exists citas_tipo_check;
alter table public.citas add constraint citas_tipo_check
  check (tipo in ('visita', 'llamada', 'firma', 'tasacion', 'evento', 'captacion', 'recordatorio', 'tarea', 'otro'));
