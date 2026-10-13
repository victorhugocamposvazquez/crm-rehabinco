-- demandas_equipo_guarda volvió a definir marcar_cliente_vinculado() con new.ofertante_id.
-- En INSERT en demandas Postgres evalúa el record y falla: "record new has no field ofertante_id".

create or replace function public.marcar_cliente_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  persona uuid;
  fila jsonb;
begin
  fila := to_jsonb(new);
  persona := case TG_TABLE_NAME
    when 'propiedades' then nullif(fila ->> 'ofertante_id', '')::uuid
    else nullif(fila ->> 'cliente_id', '')::uuid
  end;
  if persona is null then
    return new;
  end if;
  begin
    update public.clientes
    set es_cliente = true,
        updated_at = now()
    where id = persona
      and es_cliente is distinct from true;
  exception
    when others then
      raise warning 'marcar_cliente_vinculado: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.marcar_cliente_vinculado() from public, anon;
grant execute on function public.marcar_cliente_vinculado() to authenticated;
