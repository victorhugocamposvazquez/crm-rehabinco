-- Dominio externo de la web. El CRM sigue en crm.rehabinco.es.

alter table public.web_sitio
  add column if not exists dominio text;

update public.web_sitio
set dominio = 'web.rehabinco.es'
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and dominio is null;

create unique index if not exists web_sitio_dominio
  on public.web_sitio (dominio)
  where dominio is not null;

create or replace function public.web_dominio()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select dominio
  from public.web_sitio
  where tenant_id = '00000000-0000-4000-8000-000000000001'
$$;

revoke all on function public.web_dominio() from public;
grant execute on function public.web_dominio() to anon, authenticated;
