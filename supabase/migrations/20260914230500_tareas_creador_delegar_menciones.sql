-- Creador distinto del asignado, delegación y menciones @ en comentarios.
alter table public.tareas
  add column if not exists creado_por uuid references public.profiles (id) on delete restrict;

update public.tareas
set creado_por = comercial_id
where creado_por is null;

alter table public.tareas
  alter column creado_por set default auth.uid();

alter table public.tareas
  alter column creado_por set not null;

alter table public.tareas
  add column if not exists mencionados uuid[] not null default '{}';

alter table public.tareas_actividad
  add column if not exists mencionados uuid[] not null default '{}';

drop policy if exists "Comercial lee tareas" on public.tareas;
create policy "Comercial lee tareas"
  on public.tareas for select
  to authenticated
  using (
    public.is_agente()
    and (
      comercial_id = auth.uid()
      or creado_por = auth.uid()
      or auth.uid() = any (mencionados)
    )
  );

drop policy if exists "Comercial crea sus tareas" on public.tareas;
create policy "Comercial crea sus tareas"
  on public.tareas for insert
  to authenticated
  with check (public.is_agente() and creado_por = auth.uid());

drop policy if exists "Comercial actualiza sus tareas" on public.tareas;
create policy "Comercial actualiza sus tareas"
  on public.tareas for update
  to authenticated
  using (
    public.is_agente()
    and (
      comercial_id = auth.uid()
      or creado_por = auth.uid()
      or auth.uid() = any (mencionados)
    )
  )
  with check (
    public.is_agente()
    and (
      comercial_id = auth.uid()
      or creado_por = auth.uid()
      or auth.uid() = any (mencionados)
    )
  );

drop policy if exists "Comercial borra sus tareas" on public.tareas;
create policy "Comercial borra sus tareas"
  on public.tareas for delete
  to authenticated
  using (public.is_agente() and (comercial_id = auth.uid() or creado_por = auth.uid()));

drop policy if exists "Comercial lee actividad de sus tareas" on public.tareas_actividad;
create policy "Comercial lee actividad de sus tareas"
  on public.tareas_actividad for select
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and (
          t.comercial_id = auth.uid()
          or t.creado_por = auth.uid()
          or auth.uid() = any (t.mencionados)
        )
    )
  );

drop policy if exists "Comercial escribe actividad de sus tareas" on public.tareas_actividad;
create policy "Comercial escribe actividad de sus tareas"
  on public.tareas_actividad for insert
  to authenticated
  with check (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and (
          t.comercial_id = auth.uid()
          or t.creado_por = auth.uid()
          or auth.uid() = any (t.mencionados)
        )
    )
  );

drop policy if exists "Comercial borra actividad de sus tareas" on public.tareas_actividad;
create policy "Comercial borra actividad de sus tareas"
  on public.tareas_actividad for delete
  to authenticated
  using (
    public.is_agente()
    and exists (
      select 1 from public.tareas t
      where t.id = tareas_actividad.tarea_id
        and (t.comercial_id = auth.uid() or t.creado_por = auth.uid())
    )
  );
