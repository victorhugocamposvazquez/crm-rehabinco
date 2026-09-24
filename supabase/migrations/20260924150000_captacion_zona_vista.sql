alter table public.captacion_anuncios
  add column if not exists zona_id text;

alter table public.captacion_brightdata_zonas
  add column if not exists operacion text not null default 'venta';

alter table public.captacion_brightdata_zonas
  drop constraint if exists captacion_brightdata_zonas_operacion_check;

alter table public.captacion_brightdata_zonas
  add constraint captacion_brightdata_zonas_operacion_check
  check (operacion in ('venta', 'alquiler'));

-- Anuncios de las ciudades enteras (ids viejos coruna/santiago/ferrol): distrito por
-- el centro más cercano, o «desconocida» si no hay coordenadas. No entran en retirados
-- hasta que una recogida nueva los vea en un listado.
with centros(ciudad, id, lat, lng) as (
  values
    ('coruna', 'a-coruna-ensanche-juan-florez', 43.3672, -8.4068),
    ('coruna', 'a-coruna-ciudad-vieja-centro', 43.3705, -8.3958),
    ('coruna', 'a-coruna-monte-alto-zalaeta-atocha', 43.3740, -8.3970),
    ('coruna', 'a-coruna-riazor-visma', 43.3692, -8.4125),
    ('santiago', 'santiago-centro', 42.8805, -8.5440),
    ('santiago', 'santiago-ensanche', 42.8760, -8.5400),
    ('ferrol', 'ferrol-centro', 43.4830, -8.2320),
    ('ferrol', 'ferrol-esteiro', 43.4860, -8.2400)
),
ciudad as (
  select
    a.id,
    case
      when translate(lower(coalesce(a.municipio, '') || ' ' || coalesce(a.zona, '')), 'áéíóú', 'aeiou') ~ 'santiago' then 'santiago'
      when translate(lower(coalesce(a.municipio, '') || ' ' || coalesce(a.zona, '')), 'áéíóú', 'aeiou') ~ 'ferrol' then 'ferrol'
      when translate(lower(coalesce(a.municipio, '') || ' ' || coalesce(a.zona, '')), 'áéíóú', 'aeiou') ~ 'coruna'
        and translate(lower(coalesce(a.municipio, '') || ' ' || coalesce(a.zona, '')), 'áéíóú', 'aeiou') !~ 'oleiros|arteixo|sada|cambre|culleredo'
        then 'coruna'
    end as ciudad
  from public.captacion_anuncios a
  where a.portal_id = 'idealista' and a.zona_id is null
)
update public.captacion_anuncios a
set zona_id = coalesce(
  (
    select c.id
    from centros c
    where c.ciudad = ciudad.ciudad and a.lat is not null and a.lng is not null
    order by (c.lat - a.lat) ^ 2 + (c.lng - a.lng) ^ 2
    limit 1
  ),
  'desconocida'
)
from ciudad
where a.id = ciudad.id and ciudad.ciudad is not null;
