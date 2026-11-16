create table if not exists public.publicacion_plantilla (
  id smallint primary key default 1,
  formato text not null default 'ig-cuadrado',
  estilo text not null default 'barra',
  campos jsonb not null default '["precio","localidad","metros","habitaciones"]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint publicacion_plantilla_id_unica check (id = 1)
);

alter table public.publicacion_plantilla enable row level security;

drop policy if exists "Equipo gestiona plantilla de redes" on public.publicacion_plantilla;
create policy "Equipo gestiona plantilla de redes"
  on public.publicacion_plantilla
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

insert into public.publicacion_plantilla (id)
values (1)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
