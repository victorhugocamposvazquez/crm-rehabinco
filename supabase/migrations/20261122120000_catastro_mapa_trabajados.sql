-- Catastro 2.0 (mapa de edificios): parcelas que cada usuario marca como trabajadas.
-- Independiente de catastro_fincas: el mapa lee el WFS INSPIRE en vivo y la parcela
-- puede no estar persistida.
create table if not exists public.catastro_mapa_trabajados (
  user_id uuid not null references auth.users (id) on delete cascade,
  parcel_ref text not null check (parcel_ref ~ '^[0-9A-Z]{14}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, parcel_ref)
);

comment on table public.catastro_mapa_trabajados is
  'Parcelas (ref. catastral de 14) marcadas como trabajadas en /catastro/mapa, por usuario.';

alter table public.catastro_mapa_trabajados enable row level security;
revoke all on table public.catastro_mapa_trabajados from anon, public;
grant select, insert, delete on table public.catastro_mapa_trabajados to authenticated;

drop policy if exists "Cada uno ve sus parcelas trabajadas" on public.catastro_mapa_trabajados;
create policy "Cada uno ve sus parcelas trabajadas"
  on public.catastro_mapa_trabajados for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Cada uno marca sus parcelas" on public.catastro_mapa_trabajados;
create policy "Cada uno marca sus parcelas"
  on public.catastro_mapa_trabajados for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Cada uno desmarca sus parcelas" on public.catastro_mapa_trabajados;
create policy "Cada uno desmarca sus parcelas"
  on public.catastro_mapa_trabajados for delete to authenticated
  using (user_id = auth.uid());
