alter table public.captacion_anuncios
  add column if not exists telefono_estado text,
  add column if not exists telefono_tipo text,
  add column if not exists telefono_reintentar_en timestamptz;

alter table public.captacion_anuncios
  drop constraint if exists captacion_anuncios_telefono_estado_check;

alter table public.captacion_anuncios
  add constraint captacion_anuncios_telefono_estado_check check (
    telefono_estado is null
    or telefono_estado in ('pendiente', 'solo_mensaje', 'virtual', 'real', 'fallo', 'no_solicitado')
  );

alter table public.captacion_anuncios
  drop constraint if exists captacion_anuncios_telefono_tipo_check;

alter table public.captacion_anuncios
  add constraint captacion_anuncios_telefono_tipo_check check (
    telefono_tipo is null or telefono_tipo = 'virtual_idealista'
  );

update public.captacion_anuncios
set telefono_tipo = 'virtual_idealista',
    telefono_estado = 'virtual'
where contacto_telefono ~ '^\+3488135'
   or contacto_telefono ~ '^3488135';

update public.captacion_anuncios
set telefono_estado = 'real'
where contacto_telefono is not null
  and telefono_estado is null
  and (telefono_tipo is null or telefono_tipo <> 'virtual_idealista');

update public.captacion_anuncios
set telefono_estado = 'fallo'
where telefono_pendiente = true and telefono_estado is null;

update public.captacion_anuncios
set telefono_estado = 'no_solicitado'
where portal_id = 'idealista'
  and anunciante <> 'particular'
  and contacto_telefono is null
  and telefono_estado is null;

update public.captacion_anuncios
set telefono_estado = 'pendiente'
where telefono_estado is null
  and contacto_telefono is null
  and portal_id = 'idealista'
  and anunciante = 'particular';

update public.captacion_anuncios a
set contacto_clave = 'nom:' || lower(trim(a.contacto_nombre)) || '|' || lower(trim(a.municipio))
where a.telefono_tipo = 'virtual_idealista'
  and a.contacto_nombre is not null
  and a.municipio is not null
  and length(trim(a.contacto_nombre)) >= 2;

update public.captacion_telefono_config
set pausado = false, pausado_en = null
where id = 1;
