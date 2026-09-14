-- Documentos privados del inmueble. Bucket no público: se sirve con URL firmada.

create table if not exists public.inmueble_documentos (
  id uuid primary key default gen_random_uuid(),
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  tipo text not null default 'otro'
    check (tipo in ('nota_simple', 'certificado_energetico', 'cedula', 'escritura', 'otro')),
  nombre text not null,
  path text not null,
  created_at timestamptz not null default now()
);

comment on table public.inmueble_documentos is
  'Documentos privados del inmueble (nota simple, energético, cédula, escritura). No van a la ficha pública.';

create index if not exists idx_inmueble_documentos_propiedad
  on public.inmueble_documentos (propiedad_id, created_at desc);

alter table public.inmueble_documentos enable row level security;
revoke all on table public.inmueble_documentos from anon, public;
grant select, insert, delete on table public.inmueble_documentos to authenticated;

create policy "Admin gestiona documentos inmueble"
  on public.inmueble_documentos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Equipo lee documentos inmueble"
  on public.inmueble_documentos for select
  to authenticated
  using (public.is_agente());

create policy "Equipo sube documentos inmueble"
  on public.inmueble_documentos for insert
  to authenticated
  with check (public.is_agente() and user_id = auth.uid());

create policy "Equipo borra documentos inmueble"
  on public.inmueble_documentos for delete
  to authenticated
  using (public.is_agente() and user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('inmueble-docs', 'inmueble-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "inmueble_docs_select_auth" on storage.objects;
create policy "inmueble_docs_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'inmueble-docs');

drop policy if exists "inmueble_docs_insert_auth" on storage.objects;
create policy "inmueble_docs_insert_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'inmueble-docs');

drop policy if exists "inmueble_docs_update_auth" on storage.objects;
create policy "inmueble_docs_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'inmueble-docs')
  with check (bucket_id = 'inmueble-docs');

drop policy if exists "inmueble_docs_delete_auth" on storage.objects;
create policy "inmueble_docs_delete_auth"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'inmueble-docs');
