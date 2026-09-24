alter table public.captacion_anuncios
  add column if not exists publicado_en_portal timestamptz,
  add column if not exists publicado_precision text;

alter table public.captacion_anuncios
  drop constraint if exists captacion_anuncios_publicado_precision_check;

alter table public.captacion_anuncios
  add constraint captacion_anuncios_publicado_precision_check
  check (publicado_precision is null or publicado_precision in ('24h', '48h', '7d', '30d', '>30d', 'exacta'));
