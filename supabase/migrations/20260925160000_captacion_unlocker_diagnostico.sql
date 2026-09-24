alter table public.captacion_paginas_pendientes
  add column if not exists unlocker_zone text,
  add column if not exists unlocker_url text,
  add column if not exists http_status integer,
  add column if not exists content_type text,
  add column if not exists bytes integer,
  add column if not exists cuerpo_muestra text;
