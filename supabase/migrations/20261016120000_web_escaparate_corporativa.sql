-- Escaparate para la web corporativa: stock disponible del CRM (sin depender de publicar_web).

create or replace function public.web_escaparate()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(fila order by fila->>'orden' desc, fila->>'referencia')
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
        'orden', extract(epoch from p.updated_at)::bigint,
        'fotos', coalesce((
          select jsonb_agg(m.url order by m.portada desc, m.orden, m.created_at)
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

revoke all on function public.web_escaparate() from public;
grant execute on function public.web_escaparate() to anon, authenticated;

update public.web_sitio
set publicado = true, diseno = 'noche', updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000001';
