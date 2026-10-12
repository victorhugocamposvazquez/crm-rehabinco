-- search_path en las funciones security definer del AVM, y marca el respaldo
-- a Rehabinco para quitarlo antes de registrar una segunda agencia.

create or replace function market_zone_stats_refresh() returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'market_zone_stats'
      and c.relispopulated
  ) then
    refresh materialized view concurrently market_zone_stats;
  else
    refresh materialized view market_zone_stats;
  end if;
end $$;

create or replace function avm_current_tenant() returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid,
    (
      select m.tenant_id
      from public.memberships m
      where m.user_id = auth.uid()
      order by m.created_at
      limit 1
    ),
    -- TODO: eliminar antes del segundo tenant
    case
      when auth.uid() is not null then (
        select t.id from public.tenants t where t.slug = 'rehabinco' limit 1
      )
    end
  );
$$;
