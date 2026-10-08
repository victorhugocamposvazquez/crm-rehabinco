-- El CASE leía new.ofertante_id también en demandas, y esa tabla no tiene esa columna.
-- El insert fallaba con 400 antes de guardar.

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
      null;
  end;
  return new;
end;
$$;

revoke all on function public.marcar_cliente_vinculado() from public, anon;
grant execute on function public.marcar_cliente_vinculado() to authenticated;
