-- Notas/actividad de cada tarea y vínculo a partes de visita.
alter table public.tareas
  add column if not exists parte_visita_id uuid references public.partes_visita (id) on delete set null;

create table if not exists public.tareas_actividad (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  tipo text not null default 'nota'
    check (tipo in ('nota', 'creada', 'estado', 'calendario', 'vinculo')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tareas_actividad_tarea
  on public.tareas_actividad (tarea_id, created_at);

comment on table public.tareas_actividad is
  'Notas y eventos de una tarea: creación, calendario, vínculos y comentarios.';

alter table public.tareas_actividad enable row level security;
revoke all on table public.tareas_actividad from anon, public;
grant select, insert, update, delete on table public.tareas_actividad to authenticated;

create policy "Admin gestiona actividad de tareas"
  on public.tareas_actividad for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Comercial lee actividad de sus tareas"
  on public.tareas_actividad for select
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and t.comercial_id = auth.uid()
    )
  );

create policy "Comercial escribe actividad de sus tareas"
  on public.tareas_actividad for insert
  to authenticated
  with check (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and t.comercial_id = auth.uid()
    )
  );

create policy "Comercial borra actividad de sus tareas"
  on public.tareas_actividad for delete
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and t.comercial_id = auth.uid()
    )
  );
