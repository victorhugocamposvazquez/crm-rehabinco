-- Agenda compartida: cualquier miembro del equipo puede borrar contactos (no solo el creador).

drop policy if exists "Admin puede todo en clientes" on public.clientes;
drop policy if exists "Agente CRUD sus clientes" on public.clientes;
drop policy if exists "Equipo gestiona clientes" on public.clientes;

create policy "Equipo gestiona clientes"
  on public.clientes
  for all
  to authenticated
  using (public.is_equipo())
  with check (public.is_equipo());

-- El editor Garal sigue pudiendo leer contactos al armar presupuestos.
drop policy if exists "Editor lee clientes para presupuestos" on public.clientes;
create policy "Editor lee clientes para presupuestos"
  on public.clientes
  for select
  to authenticated
  using (public.is_editor());
