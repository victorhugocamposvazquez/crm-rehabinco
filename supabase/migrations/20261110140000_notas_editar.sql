-- Editar texto de notas (calendario/tareas y contactos).

grant update on table public.clientes_notas to authenticated;

create or replace function public.puede_editar_notas_crm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('superadmin', 'admin', 'agente', 'comercial', 'catastro_user')
  );
$$;

revoke all on function public.puede_editar_notas_crm() from public, anon;
grant execute on function public.puede_editar_notas_crm() to authenticated;

drop policy if exists "Equipo actualiza notas de clientes" on public.clientes_notas;
create policy "Equipo actualiza notas de clientes"
  on public.clientes_notas for update
  to authenticated
  using (public.puede_editar_notas_crm())
  with check (public.puede_editar_notas_crm());

drop policy if exists "Equipo actualiza notas de tareas" on public.tareas_actividad;
create policy "Equipo actualiza notas de tareas"
  on public.tareas_actividad for update
  to authenticated
  using (public.puede_editar_notas_crm() and tipo = 'nota')
  with check (public.puede_editar_notas_crm() and tipo = 'nota');
