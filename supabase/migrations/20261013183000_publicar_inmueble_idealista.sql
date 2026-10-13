-- El alta de un inmueble dispara propiedades_asignar_referencia().
-- Esa función no era security definer y authenticated no tenía EXECUTE,
-- así que el INSERT devolvía 403 (permission denied for function).

create or replace function public.propiedades_asignar_referencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referencia is null or btrim(new.referencia) = '' then
    new.referencia := public.siguiente_referencia_inmueble();
  end if;
  if new.comercial_id is null then
    new.comercial_id := new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.propiedades_asignar_referencia() from public, anon;
grant execute on function public.propiedades_asignar_referencia() to authenticated, service_role;

revoke all on function public.siguiente_referencia_inmueble() from public, anon;
grant execute on function public.siguiente_referencia_inmueble() to authenticated, service_role;

alter table public.propiedades
  add column if not exists publicar_web boolean not null default false,
  add column if not exists publicar_idealista boolean not null default false,
  add column if not exists certificado_energetico text;

alter table public.propiedades
  drop constraint if exists propiedades_certificado_energetico_check;

alter table public.propiedades
  add constraint propiedades_certificado_energetico_check
  check (
    certificado_energetico is null
    or certificado_energetico in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'en_tramite', 'exento')
  );

comment on column public.propiedades.publicar_web is
  'Marcado para la web propia. El envío se conecta después.';
comment on column public.propiedades.publicar_idealista is
  'Marcado para Idealista. El envío se conecta después; el alta ya exige los campos del volcado.';
