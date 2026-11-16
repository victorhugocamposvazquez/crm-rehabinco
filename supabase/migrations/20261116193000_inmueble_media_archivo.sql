-- Archivo del piso: retoques y publicaciones viven en la misma tabla,
-- pero no son fotos del anuncio. La web y Idealista siguen filtrando tipo = 'foto'.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'inmueble_media'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%tipo%'
  loop
    execute format('alter table public.inmueble_media drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.inmueble_media
  add constraint inmueble_media_tipo_check
  check (tipo in ('foto', 'video', 'plano', 'retocada', 'publicacion'));

alter table public.inmueble_media
  add column if not exists origen_id uuid references public.inmueble_media (id) on delete set null;

alter table public.inmueble_media
  add column if not exists retoque text;

comment on column public.inmueble_media.origen_id is 'Foto del anuncio de la que sale un retoque o una publicación.';
comment on column public.inmueble_media.retoque is 'Preset de retoque: luz, enderezar, trastos, cielo, amueblar.';

create index if not exists idx_inmueble_media_origen on public.inmueble_media (origen_id);

-- La carpeta del piso es del equipo, no del usuario que subió el archivo.
drop policy if exists "Comercial CRUD su media" on public.inmueble_media;
drop policy if exists "Equipo gestiona media de inmuebles" on public.inmueble_media;
create policy "Equipo gestiona media de inmuebles"
  on public.inmueble_media
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

notify pgrst, 'reload schema';
