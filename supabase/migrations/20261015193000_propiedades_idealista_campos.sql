-- Tipología Idealista y visibilidad de dirección en portales.

alter table public.propiedades
  add column if not exists idealista_tipo text,
  add column if not exists idealista_visibilidad_direccion text not null default 'exacta';

alter table public.propiedades
  drop constraint if exists propiedades_idealista_tipo_check;

alter table public.propiedades
  add constraint propiedades_idealista_tipo_check
  check (
    idealista_tipo is null
    or idealista_tipo in (
      'piso', 'atico', 'duplex', 'estudio', 'bajo', 'chalet', 'adosado', 'casa_pueblo',
      'edificio', 'local', 'oficina', 'garaje', 'trastero', 'terreno', 'nave'
    )
  );

alter table public.propiedades
  drop constraint if exists propiedades_idealista_visibilidad_direccion_check;

alter table public.propiedades
  add constraint propiedades_idealista_visibilidad_direccion_check
  check (
    idealista_visibilidad_direccion in ('exacta', 'solo_calle', 'oculta')
  );

alter table public.propiedades
  drop constraint if exists propiedades_tipo_inmueble_check;

alter table public.propiedades
  add constraint propiedades_tipo_inmueble_check
  check (
    tipo_inmueble is null
    or tipo_inmueble in (
      'piso', 'atico', 'bajo', 'chalet', 'adosado', 'local',
      'oficina', 'nave', 'solar', 'garaje', 'trastero', 'edificio'
    )
  );

comment on column public.propiedades.idealista_tipo is
  'Tipología para el volcado a Idealista (piso, edificio, local…).';
comment on column public.propiedades.idealista_visibilidad_direccion is
  'Cómo mostrar la dirección en portales: exacta, solo calle u oculta.';
