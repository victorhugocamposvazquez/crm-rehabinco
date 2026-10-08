-- Un contacto pasa a cliente a mano (es_cliente) o al ligarlo a demanda, inmueble, presupuesto o factura.

alter table public.clientes
  add column if not exists es_cliente boolean not null default false;

comment on column public.clientes.es_cliente is
  'True cuando es cliente: a mano, o al ligarlo a una demanda, un inmueble, un presupuesto o una factura.';

update public.clientes c
set es_cliente = true
where exists (select 1 from public.demandas d where d.cliente_id = c.id)
   or exists (select 1 from public.propiedades p where p.ofertante_id = c.id)
   or exists (select 1 from public.presupuestos pr where pr.cliente_id = c.id)
   or exists (select 1 from public.facturas f where f.cliente_id = c.id);

create or replace function public.marcar_cliente_vinculado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  persona uuid;
begin
  persona := case TG_TABLE_NAME
    when 'propiedades' then new.ofertante_id
    else new.cliente_id
  end;
  if persona is not null then
    update public.clientes
    set es_cliente = true,
        updated_at = now()
    where id = persona
      and es_cliente is distinct from true;
  end if;
  return new;
end;
$$;

revoke all on function public.marcar_cliente_vinculado() from public, anon;
grant execute on function public.marcar_cliente_vinculado() to authenticated;

drop trigger if exists demandas_marca_cliente on public.demandas;
create trigger demandas_marca_cliente
  after insert or update of cliente_id on public.demandas
  for each row execute function public.marcar_cliente_vinculado();

drop trigger if exists propiedades_marca_cliente on public.propiedades;
create trigger propiedades_marca_cliente
  after insert or update of ofertante_id on public.propiedades
  for each row execute function public.marcar_cliente_vinculado();

drop trigger if exists presupuestos_marca_cliente on public.presupuestos;
create trigger presupuestos_marca_cliente
  after insert or update of cliente_id on public.presupuestos
  for each row execute function public.marcar_cliente_vinculado();

drop trigger if exists facturas_marca_cliente on public.facturas;
create trigger facturas_marca_cliente
  after insert or update of cliente_id on public.facturas
  for each row execute function public.marcar_cliente_vinculado();
