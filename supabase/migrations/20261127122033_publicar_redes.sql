alter table public.propiedades
  add column if not exists publicar_redes boolean not null default false;

comment on column public.propiedades.publicar_redes is
  'Si está marcado, el inmueble sale en el Estudio para publicarlo en redes.';
