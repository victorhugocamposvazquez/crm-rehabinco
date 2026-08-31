-- Propuesta técnica del presupuesto (portada, datos, zonas, programa, condiciones)
-- y unidad/capítulo en líneas para mediciones tipo plantilla.

alter table public.presupuestos
  add column if not exists propuesta jsonb not null default '{}'::jsonb;

comment on column public.presupuestos.propuesta is
  'Bloques de la propuesta: portada, emplazamiento, plazo, objeto, zonas, programa, condiciones.';

alter table public.presupuesto_lineas
  add column if not exists unidad text not null default 'ud';

alter table public.presupuesto_lineas
  add column if not exists capitulo text;

comment on column public.presupuesto_lineas.unidad is 'Unidad de medición (ud, m², ml, h…).';
comment on column public.presupuesto_lineas.capitulo is 'Agrupación de partidas en el PDF (p. ej. 01 · PAVIMENTOS).';
