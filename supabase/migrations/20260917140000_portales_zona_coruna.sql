-- Portales crawler: yaencontre/tucasa inactivos; activación adaptadores; zona prueba A Coruña.

insert into public.captacion_portales (id, nombre, activo, transport, filtro_particular_nativo)
values
  ('yaencontre', 'Yaencontre', false, 'http', true),
  ('tucasa', 'TuCasa', false, 'http', true)
on conflict (id) do update set
  nombre = excluded.nombre,
  activo = false,
  updated_at = now();

update public.captacion_portales set
  activo = true,
  transport = 'http',
  filtro_particular_nativo = true,
  updated_at = now()
where id in ('habitaclia', 'pisos.com', 'milanuncios', 'fotocasa');

update public.captacion_portales set
  transport = 'http',
  filtro_particular_nativo = true,
  updated_at = now()
where id = 'milanuncios';

-- Alerta Habitaclia: Girona → A Coruña
update public.captacion_alertas set
  nombre = 'Test crawler Habitaclia A Coruña',
  municipio = 'A Coruña',
  provincia = 'A Coruña',
  portal_params = '{"provincia_slug":"a-coruna-provincia","municipio_slug":"a-coruna","solo_particulares":true}'::jsonb,
  proxima_ejecucion = now(),
  updated_at = now()
where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Alertas adicionales (requieren created_by; en prod copiar de alerta existente)
-- insert into public.captacion_alertas (... created_by) select ... from captacion_alertas limit 1;
