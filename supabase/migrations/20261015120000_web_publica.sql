-- Web pública de Rehabinco: un diseño, bloques reordenables y escaparate de inmuebles.

create table if not exists public.web_sitio (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  diseno text not null default 'claro' check (diseno in ('claro', 'noche', 'editorial')),
  publicado boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.web_bloques (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipo text not null check (tipo in ('cabecera', 'hero', 'texto', 'inmuebles', 'galeria', 'contacto', 'pie')),
  orden int not null,
  visible boolean not null default true,
  contenido jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (tenant_id, tipo)
);

create index if not exists idx_web_bloques_orden on public.web_bloques (tenant_id, orden);

alter table public.web_sitio enable row level security;
alter table public.web_bloques enable row level security;

revoke all on table public.web_sitio from anon, public;
revoke all on table public.web_bloques from anon, public;

drop policy if exists web_sitio_admin on public.web_sitio;
create policy web_sitio_admin on public.web_sitio
  for all to authenticated
  using (tenant_id = public.avm_current_tenant() and public.is_admin())
  with check (tenant_id = public.avm_current_tenant() and public.is_admin());

drop policy if exists web_bloques_admin on public.web_bloques;
create policy web_bloques_admin on public.web_bloques
  for all to authenticated
  using (tenant_id = public.avm_current_tenant() and public.is_admin())
  with check (tenant_id = public.avm_current_tenant() and public.is_admin());

insert into public.web_sitio (tenant_id, diseno, publicado)
values ('00000000-0000-4000-8000-000000000001', 'claro', false)
on conflict (tenant_id) do nothing;

insert into public.web_bloques (tenant_id, tipo, orden, visible, contenido)
values
  ('00000000-0000-4000-8000-000000000001', 'cabecera', 1, true, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'hero', 2, true, '{"titulo":"Rehabinco","subtitulo":"Reforma y venta de inmuebles en A Coruña","imagen_url":null}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'texto', 3, true, '{"titulo":"La agencia","cuerpo":"Compramos, reformamos y vendemos. Aquí están los inmuebles que tenemos ahora."}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'inmuebles', 4, true, '{"titulo":"Inmuebles"}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'galeria', 5, true, '{"titulo":"La casa","imagenes":[]}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'contacto', 6, true, '{"titulo":"Contacto","texto":"Cuéntanos qué buscas. Te respondemos desde la oficina."}'::jsonb),
  ('00000000-0000-4000-8000-000000000001', 'pie', 7, true, '{"texto":"REHABINCO, S.L."}'::jsonb)
on conflict (tenant_id, tipo) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('web', 'web', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit;

drop policy if exists web_select on storage.objects;
create policy web_select on storage.objects
  for select to public
  using (bucket_id = 'web');

drop policy if exists web_insert on storage.objects;
create policy web_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'web'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  );

drop policy if exists web_update on storage.objects;
create policy web_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'web'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  )
  with check (
    bucket_id = 'web'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  );

drop policy if exists web_delete on storage.objects;
create policy web_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'web'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  );

-- Escaparate. Misma regla que faltasWeb: título o dirección, localidad, precio y descripción.
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
    select coalesce(jsonb_agg(fila order by fila->>'referencia'), '[]'::jsonb)
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
        'fotos', coalesce((
          select jsonb_agg(m.url order by m.portada desc, m.orden, m.created_at)
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

revoke all on function public.web_publica(text) from public;
grant execute on function public.web_publica(text) to anon, authenticated;
