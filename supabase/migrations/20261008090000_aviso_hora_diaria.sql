alter table public.crm_aviso_prefs
  add column if not exists hora_diaria smallint not null default 10;

alter table public.crm_aviso_prefs
  drop constraint if exists crm_aviso_prefs_hora_diaria_rango;

alter table public.crm_aviso_prefs
  add constraint crm_aviso_prefs_hora_diaria_rango
  check (hora_diaria >= 0 and hora_diaria <= 23);

comment on column public.crm_aviso_prefs.hora_diaria is
  'Hora de España (0-23) del recordatorio diario. Por defecto las 10.';
