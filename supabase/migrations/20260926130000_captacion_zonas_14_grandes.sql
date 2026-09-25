-- Recogida diaria: los 14 municipios grandes de A Coruña (catálogo en zonas.ts). Resto desactivado.

update public.captacion_brightdata_zonas
set activa = false,
    updated_at = now();

insert into public.captacion_brightdata_zonas (id, activa, operacion, estimado, updated_at)
values
  ('a-coruna', true, 'venta', 968, now()),
  ('santiago-de-compostela', true, 'venta', 502, now()),
  ('ferrol', true, 'venta', 655, now()),
  ('oleiros', true, 'venta', 392, now()),
  ('arteixo', true, 'venta', 159, now()),
  ('culleredo', true, 'venta', 145, now()),
  ('sada', true, 'venta', 145, now()),
  ('bergondo', true, 'venta', 128, now()),
  ('cambre', true, 'venta', 101, now()),
  ('carral', true, 'venta', 62, now()),
  ('abegondo', true, 'venta', 56, now()),
  ('naron', true, 'venta', 377, now()),
  ('ribeira', true, 'venta', 252, now()),
  ('boiro', true, 'venta', 134, now())
on conflict (id) do update
set activa = true,
    operacion = excluded.operacion,
    estimado = excluded.estimado,
    updated_at = now();
