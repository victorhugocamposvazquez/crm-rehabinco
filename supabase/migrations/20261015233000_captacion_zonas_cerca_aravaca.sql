-- Barrios de Moncloa y Pozuelo, junto a Aravaca. No apaga el resto.

insert into public.captacion_brightdata_zonas (id, activa, operacion, estimado, updated_at)
values
  ('valdemarin', true, 'venta', 59, now()),
  ('el-plantio', true, 'venta', 63, now()),
  ('casa-de-campo', true, 'venta', 24, now()),
  ('ciudad-universitaria', true, 'venta', 65, now()),
  ('valdezarza', true, 'venta', 43, now()),
  ('arguelles', true, 'venta', 160, now()),
  ('pozuelo-de-alarcon', true, 'venta', 479, now())
on conflict (id) do update
set activa = true,
    operacion = excluded.operacion,
    estimado = excluded.estimado,
    updated_at = now();
