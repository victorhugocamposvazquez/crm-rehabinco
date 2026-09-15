alter table public.crm_aviso_prefs
  add column if not exists recordatorios boolean not null default true,
  add column if not exists menciones boolean not null default true;

comment on column public.crm_aviso_prefs.recordatorios is
  'Recordatorios del calendario (tipo recordatorio).';
comment on column public.crm_aviso_prefs.menciones is
  'Comentarios en tareas donde te han mencionado con @.';
