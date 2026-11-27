-- El Estudio enseña los inmuebles salvo los marcados como no publicables.
alter table public.propiedades
  alter column publicar_redes set default true;

update public.propiedades
  set publicar_redes = true
  where publicar_redes = false;

comment on column public.propiedades.publicar_redes is
  'En falso, el inmueble no sale en el Estudio. Por defecto sale.';
