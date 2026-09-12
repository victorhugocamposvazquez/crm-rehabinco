-- Vínculo Catastro Explorer ↔ Propiedades.
-- No toca el motor catastral. No borra fincas ni reviews al borrar una Property.

-- ---------------------------------------------------------------------------
-- 1. Origen en propiedades (no existía un campo de fuente)
-- ---------------------------------------------------------------------------

alter table public.propiedades
  add column if not exists origen text not null default 'MANUAL';

alter table public.propiedades
  drop constraint if exists propiedades_origen_check;

alter table public.propiedades
  add constraint propiedades_origen_check
  check (origen in ('MANUAL', 'CATASTRO_EXPLORER'));

alter table public.propiedades
  add column if not exists catastro_linked_at timestamptz;

comment on column public.propiedades.origen is
  'MANUAL = alta CRM. CATASTRO_EXPLORER = creada o vinculada desde Catastro Explorer. No implica verificación jurídica.';

comment on column public.propiedades.catastro_linked_at is
  'Cuándo se estableció el vínculo con una CatastroFinca. No sustituye first_seen_at/last_seen_at.';

-- Una Property de Catastro puede existir sin ofertante asignado todavía.
alter table public.propiedades
  alter column ofertante_id drop not null;

create unique index if not exists idx_propiedades_catastro_rc_unica
  on public.propiedades (referencia_catastral)
  where origen = 'CATASTRO_EXPLORER'
    and referencia_catastral is not null;

create index if not exists idx_propiedades_origen
  on public.propiedades (origen);

-- ---------------------------------------------------------------------------
-- 2. Relación explícita (identidades distintas)
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_property_links (
  finca_reference text not null
    references public.catastro_fincas (finca_reference) on delete restrict,
  property_id uuid not null
    references public.propiedades (id) on delete cascade,
  source text not null default 'CATASTRO_EXPLORER'
    check (source = 'CATASTRO_EXPLORER'),
  linked_by uuid not null references auth.users (id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (finca_reference),
  unique (property_id)
);

comment on table public.catastro_property_links is
  'Vínculo 1:1 de esta fase: una CatastroFinca ↔ una Property. La finca no se clona. source = CATASTRO_EXPLORER.';

create index if not exists idx_catastro_property_links_property
  on public.catastro_property_links (property_id);

alter table public.catastro_property_links enable row level security;

revoke all on table public.catastro_property_links from anon, public;
grant select, insert, delete on table public.catastro_property_links to authenticated;

drop policy if exists "Equipo lee vinculos catastro property" on public.catastro_property_links;
create policy "Equipo lee vinculos catastro property"
  on public.catastro_property_links for select
  to authenticated
  using (public.is_admin() or public.is_agente());

drop policy if exists "Equipo crea vinculos catastro property" on public.catastro_property_links;
create policy "Equipo crea vinculos catastro property"
  on public.catastro_property_links for insert
  to authenticated
  with check (
    (public.is_admin() or public.is_agente())
    and linked_by = auth.uid()
  );

drop policy if exists "Equipo borra vinculos catastro property" on public.catastro_property_links;
create policy "Equipo borra vinculos catastro property"
  on public.catastro_property_links for delete
  to authenticated
  using (public.is_admin() or linked_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Creación atómica (Property + vínculo). Recupera si ya existe.
-- ---------------------------------------------------------------------------

create or replace function public.crear_propiedad_desde_catastro(
  p_finca_reference text,
  p_titulo text,
  p_direccion text,
  p_codigo_postal text,
  p_localidad text,
  p_superficie_parcela numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_property_id uuid;
  v_created boolean := false;
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

  select id into v_property_id
  from public.propiedades
  where referencia_catastral = p_finca_reference
  order by created_at
  limit 1;

  if v_property_id is null then
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
      null,
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
    update public.propiedades
    set
      origen = 'CATASTRO_EXPLORER',
      catastro_linked_at = coalesce(catastro_linked_at, now()),
      referencia_catastral = coalesce(referencia_catastral, p_finca_reference)
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

revoke all on function public.crear_propiedad_desde_catastro(text, text, text, text, text, numeric) from public, anon;
grant execute on function public.crear_propiedad_desde_catastro(text, text, text, text, text, numeric) to authenticated;
