-- Corrige coords de oficinas: Merced estaba ~2 km al norte (falso teletrabajo in situ).
update public.fichaje_centros
set
  lat = 43.352787,
  lng = -8.393280,
  radius_m = 250,
  address = 'Rúa da Merced 57, 15009 A Coruña',
  name = 'Calle Merced'
where id = 'merced';

update public.fichaje_centros
set
  lat = 43.3305,
  lng = -8.4335,
  radius_m = 500,
  address = 'Polígono Pocomaco, A Coruña',
  name = 'Pocomaco'
where id = 'pocomaco';
