alter table public.citas
  add column if not exists lugar text;

comment on column public.citas.lugar is
  'Dirección de la visita o del evento. Puede copiarse del inmueble o escribirse a mano. Se abre en Google Maps.';
