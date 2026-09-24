alter table public.captacion_anuncios
  add column if not exists telefono_pendiente boolean not null default false,
  add column if not exists contacto_telefono_fuente text;

alter table public.captacion_paginas_pendientes
  add column if not exists intentos integer not null default 0;

alter table public.captacion_paginas_pendientes
  drop constraint if exists captacion_paginas_pendientes_tipo_check;

alter table public.captacion_paginas_pendientes
  add constraint captacion_paginas_pendientes_tipo_check check (tipo in ('listado', 'ficha', 'telefono'));

create table if not exists public.captacion_telefono_diario (
  dia date primary key,
  pedidos integer not null default 0,
  obtenidos integer not null default 0,
  fallidos integer not null default 0
);

create table if not exists public.captacion_telefono_config (
  id integer primary key default 1 check (id = 1),
  pausado boolean not null default false,
  pausado_en timestamptz
);

insert into public.captacion_telefono_config (id) values (1) on conflict (id) do nothing;
