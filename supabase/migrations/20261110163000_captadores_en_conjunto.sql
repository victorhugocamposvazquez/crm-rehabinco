-- En conjunto: varias personas captan el mismo inmueble y todas quedan visibles.

create table if not exists public.propiedad_captadores (
  propiedad_id uuid not null references public.propiedades (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (propiedad_id, profile_id)
);

comment on table public.propiedad_captadores is
  'Personas que captaron el inmueble. Una es la captura normal; varias es en conjunto.';

create index if not exists idx_propiedad_captadores_profile
  on public.propiedad_captadores (profile_id);

alter table public.propiedad_captadores enable row level security;

revoke all on table public.propiedad_captadores from anon, public;
grant select, insert, delete on table public.propiedad_captadores to authenticated;

drop policy if exists "Equipo lee captadores del inmueble" on public.propiedad_captadores;
create policy "Equipo lee captadores del inmueble"
  on public.propiedad_captadores for select
  to authenticated
  using (public.is_equipo());

drop policy if exists "Admin asigna captadores del inmueble" on public.propiedad_captadores;
create policy "Admin asigna captadores del inmueble"
  on public.propiedad_captadores for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admin quita captadores del inmueble" on public.propiedad_captadores;
create policy "Admin quita captadores del inmueble"
  on public.propiedad_captadores for delete
  to authenticated
  using (public.is_admin());

create or replace function public.propiedades_captador_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.captado_por is not null then
    insert into public.propiedad_captadores (propiedad_id, profile_id)
    values (new.id, new.captado_por)
    on conflict do nothing;
  elsif new.user_id is not null then
    insert into public.propiedad_captadores (propiedad_id, profile_id)
    values (new.id, new.user_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propiedades_captador_inicial on public.propiedades;
create trigger trg_propiedades_captador_inicial
  after insert on public.propiedades
  for each row
  execute function public.propiedades_captador_inicial();

revoke all on function public.propiedades_captador_inicial() from public, anon, authenticated;

insert into public.propiedad_captadores (propiedad_id, profile_id)
select id, coalesce(captado_por, user_id)
from public.propiedades
where coalesce(captado_por, user_id) is not null
on conflict do nothing;
