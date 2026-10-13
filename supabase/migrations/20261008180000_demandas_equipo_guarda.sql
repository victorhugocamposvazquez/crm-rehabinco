-- El equipo ve todas las demandas y las edita. Antes solo el comercial
-- asignado podía guardar: el resto veía el formulario y el update no quedaba.
-- Al guardar, marcar el contacto como cliente no puede echar atrás la demanda.

drop policy if exists "Comercial crea demandas propias" on public.demandas;
create policy "Comercial crea demandas"
  on public.demandas for insert
  to authenticated
  with check (public.is_agente());

drop policy if exists "Comercial actualiza sus demandas" on public.demandas;
create policy "Comercial actualiza demandas"
  on public.demandas for update
  to authenticated
  using (public.is_agente())
  with check (public.is_agente());

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
  if persona is not null then
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
  end if;
  return new;
end;
$$;

revoke all on function public.marcar_cliente_vinculado() from public, anon;
grant execute on function public.marcar_cliente_vinculado() to authenticated;
