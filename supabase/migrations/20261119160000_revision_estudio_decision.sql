-- El revisor aprueba o pide rectificar, y deja el motivo.

alter table public.estudio_revisiones
  add column if not exists motivo text not null default '';

alter table public.estudio_revisiones
  drop constraint if exists estudio_revisiones_estado_check;

alter table public.estudio_revisiones
  add constraint estudio_revisiones_estado_check
  check (estado in ('pendiente', 'vista', 'aprobada', 'rectificar'));

drop policy if exists "Admin marca revisiones" on public.estudio_revisiones;
create policy "Admin marca revisiones"
  on public.estudio_revisiones
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin() and estado in ('pendiente', 'vista', 'aprobada', 'rectificar'));
