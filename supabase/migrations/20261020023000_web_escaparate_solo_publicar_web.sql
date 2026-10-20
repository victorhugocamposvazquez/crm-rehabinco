-- El escaparate y la preview usan la misma regla que web_publica: solo publicar_web.

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
        'orden', extract(epoch from p.created_at)::bigint,
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
    ) listado
  ), '[]'::jsonb);
end;
$$;
