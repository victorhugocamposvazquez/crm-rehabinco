-- Los partes de visita dejan de depender de propiedades
drop index if exists public.idx_partes_visita_propiedad_id;
alter table public.partes_visita drop column if exists propiedad_id;
