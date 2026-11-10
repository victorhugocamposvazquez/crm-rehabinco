-- Quién captó el inmueble. Lo escribe un administrador; el resto del equipo solo lo ve.

alter table public.propiedades
  add column if not exists captado_por uuid references public.profiles (id) on delete set null,
  add column if not exists captado_conjunto boolean not null default false;

alter table public.propiedades
  drop constraint if exists propiedades_captado_coherente;

alter table public.propiedades
  add constraint propiedades_captado_coherente
  check (captado_conjunto = false or captado_por is null);

create index if not exists idx_propiedades_captado_por
  on public.propiedades (captado_por)
  where captado_por is not null;

comment on column public.propiedades.captado_por is
  'Persona del equipo que captó el inmueble. La fija un administrador.';
comment on column public.propiedades.captado_conjunto is
  'La captación es del equipo, sin atribuirla a una sola persona.';

create or replace function public.propiedades_guardar_captador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (new.captado_por is not null or new.captado_conjunto) and not public.is_admin() then
      raise exception 'Solo un administrador puede indicar quién captó el inmueble';
    end if;
  elsif new.captado_por is distinct from old.captado_por
     or new.captado_conjunto is distinct from old.captado_conjunto then
    if not public.is_admin() then
      raise exception 'Solo un administrador puede indicar quién captó el inmueble';
    end if;
  end if;

  if new.captado_conjunto then
    new.captado_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propiedades_guardar_captador on public.propiedades;
create trigger trg_propiedades_guardar_captador
  before insert or update on public.propiedades
  for each row
  execute function public.propiedades_guardar_captador();

revoke all on function public.propiedades_guardar_captador() from public, anon, authenticated;
