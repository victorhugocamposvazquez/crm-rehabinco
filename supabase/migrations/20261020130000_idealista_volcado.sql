-- Volcado Idealista v6 (JSON por FTP): ILC + credenciales y trazas.

alter table public.propiedades
  add column if not exists idealista_codigo text;

comment on column public.propiedades.idealista_codigo is
  'propertyCode estable en el feed Idealista v6. Si el anuncio ya existía en Idealista, debe coincidir con su código interno.';

create table if not exists public.idealista_publicacion_config (
  id smallint primary key default 1 check (id = 1),
  customer_code text,
  ftp_host text,
  ftp_port integer not null default 21,
  ftp_user text,
  ftp_password text,
  ftp_secure boolean not null default true,
  contact_name text,
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.idealista_publicacion_config is
  'Singleton: ILC (customer_code) y FTP que Idealista asigna para importar el JSON v6.';

create table if not exists public.idealista_publicacion_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ok boolean not null default false,
  anuncios_enviados integer not null default 0,
  anuncios_omitidos integer not null default 0,
  detalle jsonb,
  error text
);

comment on table public.idealista_publicacion_ejecuciones is
  'Historial de envíos del feed Idealista (FTP).';

alter table public.idealista_publicacion_config enable row level security;
alter table public.idealista_publicacion_ejecuciones enable row level security;

revoke all on table public.idealista_publicacion_config from anon, public;
revoke all on table public.idealista_publicacion_ejecuciones from anon, public;

grant select, insert, update, delete on table public.idealista_publicacion_config to service_role;
grant select, insert on table public.idealista_publicacion_ejecuciones to service_role;
