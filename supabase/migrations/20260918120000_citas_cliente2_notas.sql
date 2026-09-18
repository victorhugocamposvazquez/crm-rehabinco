-- Segundo cliente (acompañante) y notas en citas/eventos.
alter table public.citas
  add column if not exists cliente2_id uuid references public.clientes (id) on delete set null,
  add column if not exists notas text;

comment on column public.citas.cliente2_id is 'Cliente acompañante en visitas o eventos.';
comment on column public.citas.notas is 'Observaciones internas del evento o cita.';
