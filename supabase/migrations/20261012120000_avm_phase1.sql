-- =============================================================================
-- statecrm · Motor de valoración (AVM) · Fase 1
-- Supabase / PostgreSQL 15 + PostGIS
--
-- Principios:
--   * Ninguna fuente es obligatoria: cada valoración guarda qué fuentes usó.
--   * Capas de datos compartidas entre agencias (tenant_id NULL = compartido).
--   * market_listings es independiente de captación (tarjetas de listado).
--   * El entorno se guarda calculado por inmueble (a favor y en contra).
-- =============================================================================

-- PostGIS no estaba instalado. En este proyecto las extensiones viven en `extensions`
-- y el search_path de Supabase ya lo incluye.
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
do $$ begin
  create type avm_main_type as enum ('apartment', 'house', 'land', 'building');
exception when duplicate_object then null; end $$;

do $$ begin
  create type avm_operation as enum ('sale', 'rent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type avm_side as enum ('exterior', 'interior');
exception when duplicate_object then null; end $$;

do $$ begin
  create type avm_channel as enum ('crm', 'landing', 'batch');
exception when duplicate_object then null; end $$;

do $$ begin
  create type avm_zone_level as enum ('census_section', 'postcode', 'municipality', 'province', 'country');
exception when duplicate_object then null; end $$;

do $$ begin
  create type avm_mark_kind as enum ('okupacion', 'conflictividad', 'obras', 'ruido_nocturno', 'otro');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Utilidad: updated_at
-- -----------------------------------------------------------------------------
create or replace function avm_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =============================================================================
-- 1. INMUEBLE VALORADO ("twin")
--    Esquema calcado al de RealAdvisor, sin los campos suizos ni el fingerprint.
-- =============================================================================
create table if not exists avm_properties (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null,
  source                  text not null default 'manual'
                          check (source in ('manual', 'catastro', 'listing', 'landing', 'crm_property')),
  crm_property_id         uuid,                       -- enlace al inmueble del CRM si existe
  listing_id              uuid,                       -- enlace a market_listings/captación si existe
  catastral_ref           text,                       -- 20 caracteres (incluye planta/puerta)
  catastral_parcel        text,                       -- 14 caracteres

  -- Dirección
  formatted_address       text,
  route                   text,
  street_number           text,
  postcode                text,
  locality                text,
  municipality_code       text,                       -- INE 5 dígitos
  census_section          text,                       -- INE 10 dígitos
  province                text,
  country_code            text not null default 'es',
  lat                     double precision,
  lng                     double precision,
  geom                    geography(Point, 4326)
                          generated always as (
                            case when lat is not null and lng is not null
                              then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                            end
                          ) stored,
  google_place_id         text,

  -- Tipo
  main_type               avm_main_type,
  property_type           text,                       -- apartment | studio | duplex | penthouse | ...

  -- Edificio / planta
  floor_of_flat           smallint,
  number_of_floors        smallint,
  side                    avm_side,
  has_elevator            boolean,

  -- Superficies (m²)
  built_surface           numeric(8,2),
  living_surface          numeric(8,2),
  land_surface            numeric(10,2),
  balcony_surface         numeric(7,2),
  garden_surface          numeric(8,2),

  -- Antigüedad / estado
  construction_year       smallint,
  renovation_year         smallint,
  is_renovated            boolean,
  building_condition      smallint check (building_condition between 1 and 5), -- 1 ruina … 5 excelente

  -- Distribución
  number_of_rooms         smallint,
  number_of_bedrooms      smallint,
  number_of_bathrooms     smallint,
  number_of_indoor_parkings  smallint,
  number_of_outdoor_parkings smallint,

  -- Extras
  has_view                boolean,
  has_swimming_pool       boolean,
  has_balcony             boolean,
  has_garden              boolean,
  has_storage_room        boolean,
  has_fireplace           boolean,

  -- Edificio completo (rentas)
  number_of_residential_units   smallint,
  residential_yearly_rental_income numeric(12,2),
  number_of_commercial_units    smallint,
  commercial_yearly_rental_income  numeric(12,2),

  -- Datos de origen en bruto (respuesta de Catastro, ficha del anuncio…)
  catastro_raw            jsonb,
  listing_raw             jsonb,

  created_by              uuid,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists avm_properties_tenant_idx on avm_properties (tenant_id);
create index if not exists avm_properties_geom_idx on avm_properties using gist (geom);
create index if not exists avm_properties_rc_idx on avm_properties (catastral_ref);

drop trigger if exists avm_properties_updated_at on avm_properties;
create trigger avm_properties_updated_at before update on avm_properties
  for each row execute function avm_set_updated_at();

-- =============================================================================
-- 2. VALORACIONES
--    Cada ejecución guarda entradas, fuentes usadas y salida completa.
-- =============================================================================
create table if not exists avm_valuations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  property_id         uuid not null references avm_properties(id) on delete cascade,
  channel             avm_channel not null default 'crm',
  method_version      text not null,                 -- p. ej. 'live-1.0', 'comparables-1.0'
  inputs              jsonb not null,                -- snapshot del twin usado
  operation           avm_operation not null default 'sale',

  value_mid           numeric(12,0),
  value_low           numeric(12,0),                 -- P25 (o low del estimador en vivo)
  value_high          numeric(12,0),                 -- P75 (o high del estimador en vivo)
  price_per_m2        numeric(10,2),
  rent_monthly        numeric(10,0),
  gross_yield         numeric(5,2),                  -- %
  confidence          smallint check (confidence between 0 and 100),
  precision_score     smallint check (precision_score between 0 and 100), -- completitud del twin

  sources_used        jsonb not null default '[]'::jsonb,  -- [{layer, source, status}]
  comparables         jsonb,                         -- [{listing_id, distance_m, price, surface, adjustments:{}, weight}]
  zone_stats          jsonb,                         -- snapshot de market_zone_stats usado
  environment         jsonb,                         -- snapshot de environment_features
  explanation         jsonb,                         -- pasos del cálculo, legibles

  created_by          uuid,
  created_at          timestamptz not null default now()
);

create index if not exists avm_valuations_tenant_idx on avm_valuations (tenant_id, created_at desc);
create index if not exists avm_valuations_property_idx on avm_valuations (property_id, created_at desc);

-- =============================================================================
-- 3. FOTO DEL MERCADO: tarjetas de listado (compartida entre agencias)
--    Independiente de captación. Sin ficha, sin teléfono, sin fotos.
-- =============================================================================
create table if not exists market_listings (
  id                  uuid primary key default gen_random_uuid(),
  portal              text not null,                 -- idealista | fotocasa | habitaclia | pisos | milanuncios
  portal_id           text not null,
  url                 text,
  operation           avm_operation not null,
  main_type           avm_main_type not null,
  property_type       text,
  title               text,

  price               numeric(12,0) not null,
  surface             numeric(8,2),                  -- m² construidos según el portal
  rooms               smallint,
  bathrooms           smallint,
  floor               smallint,                      -- 0 = bajo; null = desconocido
  has_elevator        boolean,
  has_garage          boolean,
  has_terrace         boolean,
  is_exterior         boolean,
  condition_hint      text,                          -- 'reformar' | 'buen estado' | 'nuevo' | null (del título)
  is_agency           boolean,                       -- anunciante profesional

  locality            text,
  postcode            text,
  municipality_code   text,
  census_section      text,
  zone_slug           text,                          -- barrio/zona del portal, normalizado
  lat                 double precision,
  lng                 double precision,
  location_precision  text check (location_precision in ('exact', 'street', 'zone')),
  geom                geography(Point, 4326)
                      generated always as (
                        case when lat is not null and lng is not null
                          then ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                        end
                      ) stored,

  first_seen          date not null default current_date,
  last_seen           date not null default current_date,
  active              boolean not null default true,
  price_history       jsonb not null default '[]'::jsonb,   -- [{date, price}]
  raw                 jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (portal, portal_id)
);

create index if not exists market_listings_geom_idx on market_listings using gist (geom);
create index if not exists market_listings_filter_idx
  on market_listings (operation, main_type, active, last_seen desc);
create index if not exists market_listings_zone_idx on market_listings (census_section, postcode, municipality_code);

drop trigger if exists market_listings_updated_at on market_listings;
create trigger market_listings_updated_at before update on market_listings
  for each row execute function avm_set_updated_at();

-- Precio por m² como vista de apoyo (evita repetir la expresión)
create or replace view market_listings_ppm2 as
select
  l.*,
  case when l.surface > 0 then l.price / l.surface end as price_per_m2
from market_listings l;

-- =============================================================================
-- 4. ESTADÍSTICAS DE ZONA (vista materializada, refresco mensual)
--    Tres niveles en una sola vista: sección censal, código postal, municipio.
--    Oferta (de market_listings). La serie de cierre va en market_close_series.
-- =============================================================================
drop materialized view if exists market_zone_stats;
create materialized view market_zone_stats as
with base as (
  select
    date_trunc('month', l.last_seen)::date as month,
    l.operation,
    l.main_type,
    l.census_section,
    l.postcode,
    l.municipality_code,
    l.price / nullif(l.surface, 0) as ppm2,
    l.price
  from market_listings l
  where l.surface between 15 and 1500
    and l.price > 0
    and l.last_seen >= (current_date - interval '24 months')
),
levels as (
  select 'census_section'::avm_zone_level as zone_level, census_section as zone_key, * from base where census_section is not null
  union all
  select 'postcode'::avm_zone_level,       postcode,          * from base where postcode is not null
  union all
  select 'municipality'::avm_zone_level,   municipality_code, * from base where municipality_code is not null
)
select
  zone_level,
  zone_key,
  operation,
  main_type,
  month,
  count(*)::int                                                   as n,
  percentile_cont(0.5) within group (order by ppm2)::numeric(10,2) as median_ppm2,
  percentile_cont(0.25) within group (order by ppm2)::numeric(10,2) as p25_ppm2,
  percentile_cont(0.75) within group (order by ppm2)::numeric(10,2) as p75_ppm2,
  percentile_cont(0.5) within group (order by price)::numeric(12,0) as median_price
from levels
group by zone_level, zone_key, operation, main_type, month
with no data;

create unique index if not exists market_zone_stats_pk
  on market_zone_stats (zone_level, zone_key, operation, main_type, month);

-- Tendencia 12 meses sobre la vista materializada
create or replace view market_zone_trend as
select
  s.zone_level, s.zone_key, s.operation, s.main_type, s.month, s.n, s.median_ppm2, s.p25_ppm2, s.p75_ppm2,
  prev.median_ppm2 as median_ppm2_12m_ago,
  case when prev.median_ppm2 > 0
       then round(((s.median_ppm2 / prev.median_ppm2) - 1) * 100, 1) end as trend_12m_pct
from market_zone_stats s
left join market_zone_stats prev
  on prev.zone_level = s.zone_level and prev.zone_key = s.zone_key
 and prev.operation = s.operation and prev.main_type = s.main_type
 and prev.month = (s.month - interval '12 months')::date;

create or replace function market_zone_stats_refresh() returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- La primera vez la vista se crea WITH NO DATA y CONCURRENTLY no está permitido.
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

-- Serie de cierre (INE, Ministerio, Notariado, Registradores, ventas propias)
create table if not exists market_close_series (
  id               bigserial primary key,
  source           text not null,          -- 'ine_ipv' | 'mivau_tasado' | 'notariado' | 'registradores' | 'crm_sales'
  zone_level       avm_zone_level not null,
  zone_key         text not null,
  main_type        avm_main_type,
  period           date not null,          -- primer día del mes o trimestre
  ppm2             numeric(10,2),
  index_value      numeric(10,4),          -- para series índice (IPV)
  transactions     int,
  raw              jsonb,
  unique (source, zone_level, zone_key, main_type, period)
);

-- Descuento oferta → cierre calibrado por zona (se recalcula con las ventas propias)
create table if not exists market_discount (
  zone_level       avm_zone_level not null,
  zone_key         text not null,
  main_type        avm_main_type not null,
  discount_pct     numeric(5,2) not null,  -- p. ej. 8.00
  n_observations   int not null default 0,
  computed_at      timestamptz not null default now(),
  primary key (zone_level, zone_key, main_type)
);

-- =============================================================================
-- 5. COPIA LOCAL DE CATASTRO (descargas INSPIRE por municipio)
--    Carga con ogr2ogr desde los GML; aquí solo el esquema de destino.
-- =============================================================================
create table if not exists catastro_buildings (
  id                   bigserial primary key,
  municipality_code    text not null,
  parcel_ref           text not null,              -- 14 caracteres
  building_ref         text,                        -- gml id
  year_built           smallint,                    -- "beginning"
  current_use          text,                        -- residential | industrial | ...
  dwellings            int,                         -- numberOfDwellings
  building_units       int,                         -- numberOfBuildingUnits
  floors_above_ground  smallint,                    -- máximo de las BuildingPart
  area_m2              numeric(12,2),
  condition            text,                        -- conditionOfConstruction
  geom                 geography(MultiPolygon, 4326),
  loaded_at            timestamptz not null default now(),
  unique (municipality_code, parcel_ref, building_ref)
);
create index if not exists catastro_buildings_geom_idx on catastro_buildings using gist (geom);
create index if not exists catastro_buildings_parcel_idx on catastro_buildings (parcel_ref);

create table if not exists catastro_addresses (
  id                   bigserial primary key,
  municipality_code    text not null,
  parcel_ref           text not null,
  street_type          text,
  street_name          text,
  number               text,
  postcode             text,
  geom                 geography(Point, 4326),
  unique (municipality_code, parcel_ref, street_name, number)
);
create index if not exists catastro_addresses_geom_idx on catastro_addresses using gist (geom);
create index if not exists catastro_addresses_street_idx on catastro_addresses (municipality_code, street_name, number);

-- =============================================================================
-- 6. ENTORNO: capas abiertas (compartidas) y rasgos calculados por inmueble
-- =============================================================================
create table if not exists environment_layers (
  id          bigserial primary key,
  layer       text not null,     -- osm_poi | gtfs_stop | school | health | noise | flood | vulnerable_section | crime_municipality | air_station
  category    text,              -- supermarket | pharmacy | park | bus | train | primary_school | hospital | ...
  name        text,
  sense       text check (sense in ('positive', 'negative', 'both', 'info')),
  props       jsonb not null default '{}'::jsonb,   -- Lden, Lnight, T100, score, zone_key…
  geom        geography not null,                   -- Point, Line o Polygon según capa
  source      text,
  loaded_at   timestamptz not null default now()
);
create index if not exists environment_layers_geom_idx on environment_layers using gist (geom);
create index if not exists environment_layers_layer_idx on environment_layers (layer, category);

create table if not exists environment_features (
  property_id   uuid primary key references avm_properties(id) on delete cascade,
  computed_at   timestamptz not null default now(),
  score         smallint,                       -- 0..100 (informativo)
  positives     jsonb not null default '[]'::jsonb,  -- [{indicator, value, distance_m, label}]
  negatives     jsonb not null default '[]'::jsonb,
  flags         jsonb not null default '[]'::jsonb,  -- [{kind, severity, label, source}]
  features      jsonb not null default '{}'::jsonb   -- vector plano para el modelo hedónico
);

-- Conocimiento local de los comerciales (solo aviso, sin efecto en precio)
create table if not exists avm_zone_marks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  kind          avm_mark_kind not null,
  note          text not null,
  evidence_url  text,
  geom          geography(Polygon, 4326) not null,
  valid_until   date,
  active        boolean not null default true,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists avm_zone_marks_geom_idx on avm_zone_marks using gist (geom);
create index if not exists avm_zone_marks_tenant_idx on avm_zone_marks (tenant_id, active);

-- =============================================================================
-- 7. LANDING PÚBLICA POR AGENCIA Y LEADS
-- =============================================================================
create table if not exists avm_landing_config (
  tenant_id       uuid primary key,
  slug            text not null unique,              -- valora.statecrm.app/<slug>
  custom_domain   text unique,
  brand           jsonb not null default '{}'::jsonb, -- {name, logo_url, primary_color, accent_color}
  blocks          jsonb not null default '{"zone":true,"environment":true,"rent":true,"comparables":false}'::jsonb,
  ask_phone       boolean not null default false,
  limits          jsonb not null default '{"per_ip_per_day":10,"per_email_per_day":3}'::jsonb,
  notify_user_id  uuid,                               -- comercial por defecto
  active          boolean not null default false,
  updated_at      timestamptz not null default now()
);

create table if not exists avm_leads (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  property_id      uuid references avm_properties(id),
  valuation_id     uuid references avm_valuations(id),
  email            text not null,
  email_verified   boolean not null default false,
  phone            text,
  first_name       text,
  last_name        text,
  relationship     text,       -- owner | buyer | tenant | agent | other
  sale_horizon     text,       -- asap | from_6_to_12_months | from_1_to_2_years | from_2_years | already_for_sale | not_selling
  consent_contact  boolean not null default false,
  consent_at       timestamptz,
  source_url       text,
  utm              jsonb,
  status           text not null default 'new' check (status in ('new', 'assigned', 'contacted', 'visit', 'won', 'lost')),
  assigned_to      uuid,
  created_at       timestamptz not null default now()
);
create index if not exists avm_leads_tenant_idx on avm_leads (tenant_id, status, created_at desc);

-- =============================================================================
-- 8. FUNCIONES
-- =============================================================================

-- 8.1 Mediana de €/m² de zona para un punto: baja de nivel hasta tener n >= p_min_n.
--     Devuelve también el nivel usado (para la confianza).
create or replace function avm_zone_median(
  p_lat        double precision,
  p_lng        double precision,
  p_main_type  avm_main_type,
  p_operation  avm_operation default 'sale',
  p_min_n      int default 8
) returns table (
  zone_level  avm_zone_level,
  zone_key    text,
  month       date,
  n           int,
  median_ppm2 numeric,
  p25_ppm2    numeric,
  p75_ppm2    numeric,
  trend_12m_pct numeric
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_section text;
  v_postcode text;
  v_muni text;
begin
  -- Claves de zona del punto: primero por el listado más cercano con esas claves,
  -- más adelante por capas de secciones censales y códigos postales cargadas.
  select l.census_section, l.postcode, l.municipality_code
    into v_section, v_postcode, v_muni
  from market_listings l
  where l.geom is not null
  order by l.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  limit 1;

  return query
  with candidates as (
    select t.*, 1 as prio from market_zone_trend t
      where t.zone_level = 'census_section' and t.zone_key = v_section
        and t.operation = p_operation and t.main_type = p_main_type
    union all
    select t.*, 2 from market_zone_trend t
      where t.zone_level = 'postcode' and t.zone_key = v_postcode
        and t.operation = p_operation and t.main_type = p_main_type
    union all
    select t.*, 3 from market_zone_trend t
      where t.zone_level = 'municipality' and t.zone_key = v_muni
        and t.operation = p_operation and t.main_type = p_main_type
  ),
  latest as (
    select distinct on (prio) *
    from candidates
    where n >= p_min_n
    order by prio, month desc
  )
  select latest.zone_level, latest.zone_key, latest.month, latest.n,
         latest.median_ppm2, latest.p25_ppm2, latest.p75_ppm2, latest.trend_12m_pct
  from latest
  order by prio
  limit 1;
end $$;

-- 8.2 Comparables: radio creciente hasta reunir p_min_n; devuelve distancia y €/m².
create or replace function avm_comparables(
  p_lat        double precision,
  p_lng        double precision,
  p_main_type  avm_main_type,
  p_surface    numeric,
  p_operation  avm_operation default 'sale',
  p_min_n      int default 8,
  p_max_n      int default 20,
  p_months     int default 6
) returns table (
  listing_id      uuid,
  portal          text,
  title           text,
  price           numeric,
  surface         numeric,
  price_per_m2    numeric,
  rooms           smallint,
  floor           smallint,
  has_elevator    boolean,
  has_garage      boolean,
  is_exterior     boolean,
  condition_hint  text,
  last_seen       date,
  distance_m      numeric,
  radius_m        int
)
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_radius int;
  v_count int;
begin
  foreach v_radius in array array[300, 600, 1000, 1500, 3000] loop
    select count(*) into v_count
    from market_listings l
    where l.operation = p_operation and l.main_type = p_main_type
      and l.surface between p_surface * 0.7 and p_surface * 1.3
      and l.last_seen >= current_date - (p_months || ' months')::interval
      and l.geom is not null
      and ST_DWithin(l.geom, v_point, v_radius);
    exit when v_count >= p_min_n;
  end loop;

  return query
  select l.id, l.portal, l.title, l.price, l.surface,
         round(l.price / nullif(l.surface, 0), 2),
         l.rooms, l.floor, l.has_elevator, l.has_garage, l.is_exterior, l.condition_hint, l.last_seen,
         round(ST_Distance(l.geom, v_point)::numeric, 0),
         v_radius
  from market_listings l
  where l.operation = p_operation and l.main_type = p_main_type
    and l.surface between p_surface * 0.7 and p_surface * 1.3
    and l.last_seen >= current_date - (p_months || ' months')::interval
    and l.geom is not null
    and ST_DWithin(l.geom, v_point, v_radius)
  order by ST_Distance(l.geom, v_point)
  limit p_max_n;
end $$;

-- 8.3 Entorno: rasgos básicos por distancia (positivos y negativos) desde environment_layers.
create or replace function avm_environment(
  p_lat double precision,
  p_lng double precision
) returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_point geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_result jsonb;
begin
  with nearest as (
    select distinct on (e.layer, e.category)
      e.layer, e.category, e.sense, e.name, e.props,
      round(ST_Distance(e.geom, v_point)::numeric, 0) as distance_m
    from environment_layers e
    where ST_DWithin(e.geom, v_point, 1500)
    order by e.layer, e.category, ST_Distance(e.geom, v_point)
  ),
  counts as (
    select e.layer, e.category, count(*) as n_500m
    from environment_layers e
    where e.layer = 'osm_poi' and ST_DWithin(e.geom, v_point, 500)
    group by e.layer, e.category
  )
  select jsonb_build_object(
    'nearest', coalesce(jsonb_agg(to_jsonb(n.*)), '[]'::jsonb),
    'counts_500m', coalesce((select jsonb_object_agg(c.category, c.n_500m) from counts c), '{}'::jsonb)
  )
  into v_result
  from nearest n;
  return coalesce(v_result, '{}'::jsonb);
end $$;

-- =============================================================================
-- 9. Agencia. El CRM no trae tenant_id en el JWT: hay una sola agencia
--    (Rehabinco) y los usuarios se identifican por auth.uid() + profiles.role.
--    Orden de avm_current_tenant(): claim JWT, si no memberships, si no la
--    agencia Rehabinco para cualquier usuario autenticado.
-- =============================================================================
create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

insert into tenants (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'rehabinco', 'REHABINCO, S.L.')
on conflict (slug) do nothing;

create table if not exists memberships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

alter table memberships enable row level security;

do $$ begin
  create policy memberships_self_read on memberships
    for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

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

revoke all on function avm_current_tenant() from public;
grant execute on function avm_current_tenant() to authenticated, service_role;

-- =============================================================================
-- 10. RLS: las tablas por agencia filtran por avm_current_tenant();
--     las capas compartidas son de solo lectura para usuarios autenticados.
-- =============================================================================
alter table avm_properties      enable row level security;
alter table avm_valuations      enable row level security;
alter table avm_zone_marks      enable row level security;
alter table avm_leads           enable row level security;
alter table avm_landing_config  enable row level security;

do $$ begin
  create policy avm_properties_tenant on avm_properties
    for all to authenticated
    using (tenant_id = avm_current_tenant()) with check (tenant_id = avm_current_tenant());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy avm_valuations_tenant on avm_valuations
    for all to authenticated
    using (tenant_id = avm_current_tenant()) with check (tenant_id = avm_current_tenant());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy avm_zone_marks_tenant on avm_zone_marks
    for all to authenticated
    using (tenant_id = avm_current_tenant()) with check (tenant_id = avm_current_tenant());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy avm_leads_tenant on avm_leads
    for all to authenticated
    using (tenant_id = avm_current_tenant()) with check (tenant_id = avm_current_tenant());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy avm_landing_config_tenant on avm_landing_config
    for all to authenticated
    using (tenant_id = avm_current_tenant()) with check (tenant_id = avm_current_tenant());
exception when duplicate_object then null; end $$;

-- Capas compartidas: lectura para autenticados, escritura solo service_role (sin política = solo service_role)
alter table market_listings      enable row level security;
alter table market_close_series  enable row level security;
alter table market_discount      enable row level security;
alter table catastro_buildings   enable row level security;
alter table catastro_addresses   enable row level security;
alter table environment_layers   enable row level security;
alter table environment_features enable row level security;

do $$ begin
  create policy market_listings_read on market_listings for select to authenticated using (true);
  create policy market_close_series_read on market_close_series for select to authenticated using (true);
  create policy market_discount_read on market_discount for select to authenticated using (true);
  create policy catastro_buildings_read on catastro_buildings for select to authenticated using (true);
  create policy catastro_addresses_read on catastro_addresses for select to authenticated using (true);
  create policy environment_layers_read on environment_layers for select to authenticated using (true);
  create policy environment_features_read on environment_features for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 11. Cron sugerido (pg_cron en Supabase):
--   select cron.schedule('market_zone_stats_monthly', '15 3 1 * *', $$select market_zone_stats_refresh()$$);
--   El rastreo semanal de tarjetas y la revalorización mensual se lanzan desde
--   las rutas del CRM (Vercel) con cron de Supabase -> http.
-- =============================================================================
