-- Soft delete de inmuebles: listado activo excluye deleted_at; papelera permite restaurar.
alter table public.propiedades
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users (id) on delete set null;

create index if not exists idx_propiedades_papelera
  on public.propiedades (deleted_at desc)
  where deleted_at is not null;

create index if not exists idx_propiedades_activas
  on public.propiedades (created_at desc)
  where deleted_at is null;

comment on column public.propiedades.deleted_at is
  'Si no es null, el inmueble está en papelera (oculto del stock).';
