-- Cliente de la finca en captación, antes de que exista la propiedad.

alter table public.catastro_explorer_pipeline
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

comment on column public.catastro_explorer_pipeline.cliente_id is
  'Propietario o contacto de la finca. Puede existir antes de crear la propiedad.';

create index if not exists idx_catastro_pipeline_cliente
  on public.catastro_explorer_pipeline (cliente_id)
  where cliente_id is not null;

do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'catastro_explorer_actividad'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%tipo%'
  ) loop
    execute format('alter table public.catastro_explorer_actividad drop constraint if exists %I', r.conname);
  end loop;
end;
$$;

alter table public.catastro_explorer_actividad
  drop constraint if exists catastro_explorer_actividad_tipo_check;

alter table public.catastro_explorer_actividad
  add constraint catastro_explorer_actividad_tipo_check
  check (tipo in ('estado', 'nota', 'llamada', 'tarea', 'asignacion', 'cita', 'propiedad', 'cliente'));
