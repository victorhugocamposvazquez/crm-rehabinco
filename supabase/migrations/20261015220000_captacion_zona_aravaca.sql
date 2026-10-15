-- Aravaca (Madrid, barrio de Moncloa) entra en la recogida diaria.
-- No apaga las zonas de A Coruña.

insert into public.captacion_brightdata_zonas (id, activa, operacion, estimado, updated_at)
values ('aravaca', true, 'venta', 98, now())
on conflict (id) do update
set activa = true,
    operacion = excluded.operacion,
    estimado = excluded.estimado,
    updated_at = now();
