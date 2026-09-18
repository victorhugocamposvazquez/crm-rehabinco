alter table public.crawl_runs
  add column if not exists estado text not null default 'ok'
    check (estado in ('ok', 'parser_vacio', 'bloqueado', 'error'));

comment on column public.crawl_runs.estado is
  'parser_vacio: HTTP 200 con HTML grande pero 0 anuncios parseados en listado; cuenta como bloqueo para alarmas.';
