create table if not exists public.creatividades (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  autor_id uuid not null references public.profiles (id),
  estado jsonb not null,
  objetivo text not null,
  plantilla text not null,
  archivos jsonb not null default '{}'::jsonb,
  texto_publicacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creatividades_propiedad_idx on public.creatividades (propiedad_id, updated_at desc);

alter table public.creatividades enable row level security;

drop policy if exists "Equipo gestiona creatividades" on public.creatividades;
create policy "Equipo gestiona creatividades"
  on public.creatividades
  for all
  using (public.is_equipo())
  with check (public.is_equipo());

notify pgrst, 'reload schema';
