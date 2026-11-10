-- Quien sube el inmueble lo ha captado, salvo que un admin lo marque en conjunto
-- o lo atribuya a otra persona.

create or replace function public.propiedades_guardar_captador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cambia boolean;
begin
  if tg_op = 'UPDATE' then
    cambia := new.captado_por is distinct from old.captado_por
      or new.captado_conjunto is distinct from old.captado_conjunto;
  else
    cambia := new.captado_conjunto
      or (new.captado_por is not null and new.captado_por is distinct from new.user_id);
  end if;

  if cambia and not public.is_admin() then
    raise exception 'Solo un administrador puede indicar quién captó el inmueble';
  end if;

  if new.captado_conjunto then
    new.captado_por := null;
  elsif new.captado_por is null then
    new.captado_por := new.user_id;
  end if;
  return new;
end;
$$;

alter table public.propiedades disable trigger trg_propiedades_guardar_captador;

update public.propiedades
set captado_por = user_id
where captado_por is null
  and captado_conjunto = false
  and user_id is not null;

alter table public.propiedades enable trigger trg_propiedades_guardar_captador;
