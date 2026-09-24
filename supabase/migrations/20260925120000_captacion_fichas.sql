alter table public.captacion_anuncios
  add column if not exists enriquecido_ficha boolean not null default false,
  add column if not exists ficha_pendiente boolean not null default false;

alter table public.captacion_paginas_pendientes
  alter column recogida_id drop not null,
  add column if not exists tipo text not null default 'listado',
  add column if not exists prioridad integer not null default 0,
  add column if not exists reintentar_en timestamptz;

alter table public.captacion_paginas_pendientes
  drop constraint if exists captacion_paginas_pendientes_tipo_check;

alter table public.captacion_paginas_pendientes
  add constraint captacion_paginas_pendientes_tipo_check check (tipo in ('listado', 'ficha'));
