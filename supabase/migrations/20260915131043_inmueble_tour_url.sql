-- Tour 3D / visita virtual (Matterport, Kuula, YouTube 360).
alter table public.propiedades
  add column if not exists tour_url text;
