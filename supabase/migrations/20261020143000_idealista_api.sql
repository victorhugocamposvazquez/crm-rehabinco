-- API de publicación Idealista: credenciales (distintas de la Search API) y estado por inmueble.

alter table public.idealista_publicacion_config
  add column if not exists api_client_id text,
  add column if not exists api_client_secret text,
  add column if not exists api_base_url text;

comment on column public.idealista_publicacion_config.api_client_id is
  'Cliente OAuth de la API de publicación. No es IDEALISTA_API_KEY de captación.';
comment on column public.idealista_publicacion_config.api_base_url is
  'URL base que envía Idealista al activar la API de publicación.';

alter table public.propiedades
  add column if not exists idealista_sync_estado text,
  add column if not exists idealista_sync_error text,
  add column if not exists idealista_synced_at timestamptz,
  add column if not exists idealista_anuncios jsonb;

comment on column public.propiedades.idealista_sync_estado is
  'publicado | esperando_api | incompleto | error | pendiente_baja | despublicado';
comment on column public.propiedades.idealista_anuncios is
  'Ids devueltos por la API, por operación: {"sale":"...","rent":"..."}.';
