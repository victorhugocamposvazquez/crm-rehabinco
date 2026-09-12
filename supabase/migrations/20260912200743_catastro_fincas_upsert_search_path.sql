-- Ajuste posterior a catastro_explorer_persistencia:
-- el trigger de upsert debe fijar search_path (aviso de seguridad).
-- No toca tablas del CRM.

create or replace function public.catastro_fincas_on_upsert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.first_seen_at := least(old.first_seen_at, new.first_seen_at);
    new.last_seen_at := greatest(old.last_seen_at, new.last_seen_at);
    new.portals := (
      select coalesce(array_agg(distinct p), '{}')
      from unnest(old.portals || new.portals) as p
    );
    new.property_references := (
      select coalesce(array_agg(distinct p), '{}')
      from unnest(old.property_references || new.property_references) as p
    );
    new.postal_codes := (
      select coalesce(array_agg(distinct p), '{}')
      from unnest(old.postal_codes || new.postal_codes) as p
    );
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
