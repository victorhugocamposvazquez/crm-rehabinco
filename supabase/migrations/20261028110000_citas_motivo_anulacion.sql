-- Motivo al anular una cita/tarea/evento del calendario.
alter table public.citas
  add column if not exists motivo_anulacion text;

comment on column public.citas.motivo_anulacion is
  'Texto libre al pasar estado a cancelada (anulada). Se limpia si vuelve a prevista/hecha.';
