-- El servidor del dominio lee los secretos de avisos con la service role.
-- Así el cron de Supabase y el push no dependen de editar el proyecto de Vercel del dominio.

create schema if not exists private;

create table if not exists private.avisos_config (
  id text primary key,
  valor text not null
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.avisos_config from public, anon, authenticated;

create or replace function public.crm_secreto_aviso(nombre text)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select valor from private.avisos_config where id = nombre limit 1;
$$;

revoke all on function public.crm_secreto_aviso(text) from public;
revoke all on function public.crm_secreto_aviso(text) from anon;
revoke all on function public.crm_secreto_aviso(text) from authenticated;
grant execute on function public.crm_secreto_aviso(text) to service_role;
