-- El alta desde Catastro Explorer exige el mismo ofertante que el flujo de Propiedades.
-- No inventa un cliente. No toca el motor catastral.

drop function if exists public.crear_propiedad_desde_catastro(text, text, text, text, text, numeric);

create or replace function public.crear_propiedad_desde_catastro(
  p_finca_reference text,
  p_titulo text,
  p_direccion text,
  p_codigo_postal text,
  p_localidad text,
  p_superficie_parcela numeric,
  p_ofertante_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;
  v_created boolean := false;
  v_ofertante uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not (public.is_admin() or public.is_agente()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_finca_reference is null or char_length(p_finca_reference) <> 14 then
    raise exception 'FINCA_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.catastro_fincas where finca_reference = p_finca_reference
  ) then
    raise exception 'FINCA_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('catastro_property:' || p_finca_reference));

  select property_id into v_property_id
  from public.catastro_property_links
  where finca_reference = p_finca_reference;
  if v_property_id is not null then
    return jsonb_build_object(
      'propertyId', v_property_id,
      'created', false,
      'fincaReference', p_finca_reference
    );
  end if;

  select id, ofertante_id into v_property_id, v_ofertante
  from public.propiedades
  where referencia_catastral = p_finca_reference
  order by created_at
  limit 1;

  if v_property_id is null then
    if p_ofertante_id is null or not exists (
      select 1 from public.clientes where id = p_ofertante_id
    ) then
      raise exception 'OFERTANTE_REQUIRED' using errcode = '22023';
    end if;

    insert into public.propiedades (
      user_id,
      comercial_id,
      ofertante_id,
      titulo,
      direccion,
      codigo_postal,
      localidad,
      superficie_parcela,
      referencia_catastral,
      tipo_operacion,
      estado,
      origen,
      catastro_linked_at
    ) values (
      auth.uid(),
      auth.uid(),
      p_ofertante_id,
      nullif(trim(coalesce(p_titulo, '')), ''),
      nullif(trim(coalesce(p_direccion, '')), ''),
      nullif(trim(coalesce(p_codigo_postal, '')), ''),
      nullif(trim(coalesce(p_localidad, '')), ''),
      p_superficie_parcela,
      p_finca_reference,
      'ambos',
      'disponible',
      'CATASTRO_EXPLORER',
      now()
    )
    returning id into v_property_id;
    v_created := true;
  else
    if v_ofertante is null then
      if p_ofertante_id is null or not exists (
        select 1 from public.clientes where id = p_ofertante_id
      ) then
        raise exception 'OFERTANTE_REQUIRED' using errcode = '22023';
      end if;
    end if;
    update public.propiedades
    set
      origen = 'CATASTRO_EXPLORER',
      catastro_linked_at = coalesce(catastro_linked_at, now()),
      referencia_catastral = coalesce(referencia_catastral, p_finca_reference),
      ofertante_id = coalesce(ofertante_id, p_ofertante_id)
    where id = v_property_id;
  end if;

  insert into public.catastro_property_links (
    finca_reference,
    property_id,
    linked_by,
    linked_at,
    source
  ) values (
    p_finca_reference,
    v_property_id,
    auth.uid(),
    now(),
    'CATASTRO_EXPLORER'
  );

  return jsonb_build_object(
    'propertyId', v_property_id,
    'created', v_created,
    'fincaReference', p_finca_reference
  );
exception
  when unique_violation then
    select property_id into v_property_id
    from public.catastro_property_links
    where finca_reference = p_finca_reference;
    if v_property_id is null then
      raise;
    end if;
    return jsonb_build_object(
      'propertyId', v_property_id,
      'created', false,
      'fincaReference', p_finca_reference
    );
end;
$$;

revoke all on function public.crear_propiedad_desde_catastro(text, text, text, text, text, numeric, uuid) from public, anon;
grant execute on function public.crear_propiedad_desde_catastro(text, text, text, text, text, numeric, uuid) to authenticated;
