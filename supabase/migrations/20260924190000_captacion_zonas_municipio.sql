-- Distritos verificados el 24 sep 2026 pasan a su municipio. Los slugs de barrio quedan en docs/CAPTACION-ZONAS.md.

update public.captacion_anuncios
set zona_id = 'a-coruna'
where portal_id = 'idealista'
  and (zona_id = 'coruna' or zona_id like 'a-coruna-%');

update public.captacion_anuncios
set zona_id = 'santiago-de-compostela'
where portal_id = 'idealista'
  and (zona_id = 'santiago' or (zona_id like 'santiago-%' and zona_id <> 'santiago-de-compostela'));

update public.captacion_anuncios
set zona_id = 'ferrol'
where portal_id = 'idealista'
  and zona_id like 'ferrol-%';

update public.captacion_brightdata_zonas
set activa = false, updated_at = now()
where id in ('coruna', 'santiago')
   or id like 'a-coruna-%'
   or (id like 'santiago-%' and id <> 'santiago-de-compostela')
   or id like 'ferrol-%';

insert into public.captacion_brightdata_zonas (id, activa, operacion, estimado)
values
  ('a-coruna', true, 'venta', 968),
  ('santiago-de-compostela', true, 'venta', 502),
  ('ferrol', true, 'venta', 655)
on conflict (id) do update
set activa = true,
    estimado = excluded.estimado,
    updated_at = now();
