-- Quita CIF, dominio y razón social de Conchado Puente de las cláusulas
-- personalizadas. El apellido suelto (p. ej. Adrián Conchado) no se toca.

create or replace function public.omitir_clausulas_conchado(j jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  r record;
  outj jsonb := '{}'::jsonb;
  txt text;
begin
  if j is null or jsonb_typeof(j) <> 'object' then
    return '{}'::jsonb;
  end if;
  for r in select key, value from jsonb_each(j)
  loop
    txt := case
      when jsonb_typeof(r.value) = 'string' then r.value #>> '{}'
      else coalesce(r.value::text, '')
    end;
    if txt <> '' and txt !~* 'conchadopuente|b70101449|conchado[[:space:]]+puente' then
      outj := outj || jsonb_build_object(r.key, r.value);
    end if;
  end loop;
  return outj;
end;
$$;

create or replace function public.tg_omitir_clausulas_conchado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.clausulas_personalizadas := public.omitir_clausulas_conchado(new.clausulas_personalizadas);
  return new;
end;
$$;

drop trigger if exists trg_omitir_clausulas_conchado on public.hojas_encargo_honorarios;
create trigger trg_omitir_clausulas_conchado
  before insert or update of clausulas_personalizadas
  on public.hojas_encargo_honorarios
  for each row execute function public.tg_omitir_clausulas_conchado();

drop trigger if exists trg_omitir_clausulas_conchado on public.contratos_arras;
create trigger trg_omitir_clausulas_conchado
  before insert or update of clausulas_personalizadas
  on public.contratos_arras
  for each row execute function public.tg_omitir_clausulas_conchado();

drop trigger if exists trg_omitir_clausulas_conchado on public.contratos_pago_aplazado;
create trigger trg_omitir_clausulas_conchado
  before insert or update of clausulas_personalizadas
  on public.contratos_pago_aplazado
  for each row execute function public.tg_omitir_clausulas_conchado();

drop trigger if exists trg_omitir_clausulas_conchado on public.contratos_arrendamiento;
create trigger trg_omitir_clausulas_conchado
  before insert or update of clausulas_personalizadas
  on public.contratos_arrendamiento
  for each row execute function public.tg_omitir_clausulas_conchado();

update public.hojas_encargo_honorarios
set clausulas_personalizadas = public.omitir_clausulas_conchado(clausulas_personalizadas)
where clausulas_personalizadas::text ~* 'conchadopuente|b70101449|conchado[[:space:]]+puente';

update public.contratos_arras
set clausulas_personalizadas = public.omitir_clausulas_conchado(clausulas_personalizadas)
where clausulas_personalizadas::text ~* 'conchadopuente|b70101449|conchado[[:space:]]+puente';

update public.contratos_pago_aplazado
set clausulas_personalizadas = public.omitir_clausulas_conchado(clausulas_personalizadas)
where clausulas_personalizadas::text ~* 'conchadopuente|b70101449|conchado[[:space:]]+puente';

update public.contratos_arrendamiento
set clausulas_personalizadas = public.omitir_clausulas_conchado(clausulas_personalizadas)
where clausulas_personalizadas::text ~* 'conchadopuente|b70101449|conchado[[:space:]]+puente';
