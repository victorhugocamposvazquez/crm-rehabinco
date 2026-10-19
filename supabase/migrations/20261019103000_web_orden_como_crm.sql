-- Mismo orden que Propiedades en el CRM (created_at desc) y fotos por campo orden.

create or replace function public.web_publica(p_referencia text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := '00000000-0000-4000-8000-000000000001';
  v_sitio public.web_sitio%rowtype;
  v_nombre text;
  v_telefono text;
  v_email text;
  v_web text;
  v_logo_claro text;
  v_logo_oscuro text;
  v_bloques jsonb;
  v_inmuebles jsonb;
begin
  select * into v_sitio from public.web_sitio where tenant_id = v_tenant;
  if not found then
    return jsonb_build_object('sitio', null, 'bloques', '[]'::jsonb, 'inmuebles', '[]'::jsonb);
  end if;

  select b.name, b.phone, b.email, b.web, b.logo_light_path, b.logo_dark_path
    into v_nombre, v_telefono, v_email, v_web, v_logo_claro, v_logo_oscuro
  from public.agency_branding b
  where b.tenant_id = v_tenant;

  if v_sitio.publicado then
    select coalesce(jsonb_agg(
      jsonb_build_object('id', q.id, 'tipo', q.tipo, 'orden', q.orden, 'contenido', q.contenido)
      order by q.orden
    ), '[]'::jsonb)
      into v_bloques
    from public.web_bloques q
    where q.tenant_id = v_tenant and q.visible;
  else
    v_bloques := '[]'::jsonb;
  end if;

  if v_sitio.publicado then
    select coalesce(jsonb_agg(fila order by (fila->>'_orden')::bigint desc), '[]'::jsonb)
      into v_inmuebles
    from (
      select jsonb_build_object(
        'referencia', p.referencia,
        'titulo', coalesce(nullif(btrim(p.titulo), ''), p.direccion),
        'localidad', p.localidad,
        'tipo_inmueble', p.tipo_inmueble,
        'tipo_operacion', p.tipo_operacion,
        'precio_venta', p.precio_venta,
        'precio_alquiler', p.precio_alquiler,
        'superficie_m2', coalesce(p.superficie_construida, p.superficie_m2),
        'habitaciones', p.habitaciones,
        'banos', p.banos,
        'descripcion', p.descripcion,
        '_orden', extract(epoch from p.created_at)::bigint,
        'fotos', coalesce((
          select jsonb_agg(m.url order by m.orden, m.created_at)
          from public.inmueble_media m
          where m.propiedad_id = p.id and m.tipo = 'foto'
        ), '[]'::jsonb)
      ) as fila
      from public.propiedades p
      where p.publicar_web
        and p.estado is distinct from 'baja'
        and p.referencia is not null
        and coalesce(nullif(btrim(p.titulo), ''), nullif(btrim(p.direccion), '')) is not null
        and nullif(btrim(p.localidad), '') is not null
        and nullif(btrim(p.descripcion), '') is not null
        and (
          (p.tipo_operacion = 'alquiler' and p.precio_alquiler > 0)
          or (p.tipo_operacion = 'ambos' and p.precio_venta > 0 and p.precio_alquiler > 0)
          or (coalesce(p.tipo_operacion, 'venta') not in ('alquiler', 'ambos') and p.precio_venta > 0)
        )
        and (p_referencia is null or p.referencia = p_referencia)
    ) listado;
  else
    v_inmuebles := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'sitio', jsonb_build_object(
      'diseno', v_sitio.diseno,
      'publicado', v_sitio.publicado,
      'marca', jsonb_build_object(
        'nombre', coalesce(v_nombre, 'Rehabinco'),
        'telefono', v_telefono,
        'email', v_email,
        'web', v_web,
        'logo', case
          when v_sitio.diseno = 'noche' then coalesce(v_logo_oscuro, v_logo_claro)
          else coalesce(v_logo_claro, v_logo_oscuro)
        end
      )
    ),
    'bloques', coalesce(v_bloques, '[]'::jsonb),
    'inmuebles', coalesce(v_inmuebles, '[]'::jsonb)
  );
end;
$$;

create or replace function public.web_escaparate()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(fila order by (fila->>'orden')::bigint desc)
    from (
      select jsonb_build_object(
        'referencia', p.referencia,
        'titulo', coalesce(nullif(btrim(p.titulo), ''), nullif(btrim(p.direccion), ''), 'Inmueble'),
        'localidad', coalesce(nullif(btrim(p.localidad), ''), 'A Coruña'),
        'tipo_inmueble', p.tipo_inmueble,
        'tipo_operacion', coalesce(p.tipo_operacion, 'venta'),
        'precio_venta', p.precio_venta,
        'precio_alquiler', p.precio_alquiler,
        'superficie_m2', coalesce(p.superficie_util, p.superficie_construida, p.superficie_m2),
        'habitaciones', p.habitaciones,
        'banos', p.banos,
        'descripcion', coalesce(nullif(btrim(p.descripcion), ''), nullif(btrim(p.notas), ''), 'Consulta con Rehabinco para más detalles.'),
        'orden', extract(epoch from p.created_at)::bigint,
        'fotos', coalesce((
          select jsonb_agg(m.url order by m.orden, m.created_at)
          from public.inmueble_media m
          where m.propiedad_id = p.id and m.tipo = 'foto'
        ), '[]'::jsonb)
      ) as fila
      from public.propiedades p
      where p.estado = 'disponible'
        and p.referencia is not null
        and coalesce(nullif(btrim(p.titulo), ''), nullif(btrim(p.direccion), '')) is not null
    ) listado
  ), '[]'::jsonb);
end;
$$;
