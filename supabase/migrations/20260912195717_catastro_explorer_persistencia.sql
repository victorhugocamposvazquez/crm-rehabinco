-- Persistencia de Catastro Explorer.
-- Entidades propias del módulo: finca compartida, búsqueda privada, resultado e revisión.
-- No toca tablas del CRM interno (clientes, propiedades, visitas, leads).
--
-- Rollback (manual, si hace falta revertir esta fase):
--   drop trigger if exists trg_catastro_fincas_on_upsert on public.catastro_fincas;
--   drop function if exists public.catastro_fincas_on_upsert();
--   drop table if exists public.catastro_explorer_reviews;
--   drop table if exists public.catastro_explorer_search_results;
--   drop table if exists public.catastro_explorer_searches;
--   drop table if exists public.catastro_fincas;

-- ---------------------------------------------------------------------------
-- 1. Finca técnica compartida (identidad = RC 14)
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_fincas (
  finca_reference text primary key
    check (char_length(finca_reference) = 14),
  property_references text[] not null default '{}',
  properties jsonb not null default '[]'::jsonb,
  portals text[] not null default '{}',
  address jsonb not null default '{}'::jsonb,
  postal_code text,
  postal_codes text[] not null default '{}',
  ltp text,
  superficie_solar numeric,
  dh_status text not null
    check (dh_status in ('YES', 'NO', 'UNKNOWN', 'NOT_APPLICABLE')),
  dh_confidence numeric not null default 0,
  dh_reason text not null default '',
  dh_reason_code text,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catastro_fincas is
  'Snapshot actual de una finca de Catastro Explorer. Identidad = finca_reference (14). Entidad técnica compartida; no es una búsqueda.';

create or replace function public.catastro_fincas_on_upsert()
returns trigger
language plpgsql
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

drop trigger if exists trg_catastro_fincas_on_upsert on public.catastro_fincas;
create trigger trg_catastro_fincas_on_upsert
  before insert or update on public.catastro_fincas
  for each row execute function public.catastro_fincas_on_upsert();

-- ---------------------------------------------------------------------------
-- 2. Búsqueda privada por usuario
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_explorer_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('STREET', 'POSTAL_CODE')),
  status text not null
    check (status in ('PREPARED', 'RUNNING', 'PAUSED', 'CANCELLED', 'COMPLETED', 'FAILED')),
  provincia text not null,
  municipio text not null,
  sigla text,
  via text,
  numero text,
  postal_code text,
  horizontal_division text not null default 'ALL',
  coverage jsonb not null default '{}'::jsonb,
  totals_fincas integer not null default 0,
  totals_candidates integer not null default 0,
  totals_yes integer not null default 0,
  totals_unknown integer not null default 0,
  totals_not_applicable integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.catastro_explorer_searches is
  'Búsqueda de Catastro Explorer. Pertenece al usuario. Totales persistidos para listar recientes sin cargar resultados.';

create index if not exists idx_catastro_explorer_searches_user_updated
  on public.catastro_explorer_searches (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. Resultado histórico (búsqueda → finca)
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_explorer_search_results (
  search_id uuid not null
    references public.catastro_explorer_searches (id) on delete cascade,
  finca_reference text not null
    references public.catastro_fincas (finca_reference) on delete restrict,
  discovered_at timestamptz not null,
  classification_status text not null
    check (classification_status in ('YES', 'NO', 'UNKNOWN', 'NOT_APPLICABLE')),
  classification_reason_code text,
  postal_code_matched text,
  portals_at_discovery text[] not null default '{}',
  primary key (search_id, finca_reference)
);

comment on table public.catastro_explorer_search_results is
  'Contexto histórico: esta finca apareció en esta búsqueda. No clona la finca.';

create index if not exists idx_catastro_explorer_search_results_search
  on public.catastro_explorer_search_results (search_id);

create index if not exists idx_catastro_explorer_search_results_finca
  on public.catastro_explorer_search_results (finca_reference);

-- ---------------------------------------------------------------------------
-- 4. Revisión comercial por usuario + finca
-- ---------------------------------------------------------------------------

create table if not exists public.catastro_explorer_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  finca_reference text not null
    references public.catastro_fincas (finca_reference) on delete cascade,
  status text not null check (status in ('NONE', 'REVIEW')),
  updated_at timestamptz not null default now(),
  primary key (user_id, finca_reference)
);

comment on table public.catastro_explorer_reviews is
  'Estado comercial (NONE/REVIEW) por usuario y finca. Independiente de horizontalDivision.';

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.catastro_fincas enable row level security;
alter table public.catastro_explorer_searches enable row level security;
alter table public.catastro_explorer_search_results enable row level security;
alter table public.catastro_explorer_reviews enable row level security;

revoke all on table public.catastro_fincas from anon, public;
revoke all on table public.catastro_explorer_searches from anon, public;
revoke all on table public.catastro_explorer_search_results from anon, public;
revoke all on table public.catastro_explorer_reviews from anon, public;

grant select, insert, update on table public.catastro_fincas to authenticated;
grant select, insert, update, delete on table public.catastro_explorer_searches to authenticated;
grant select, insert, update, delete on table public.catastro_explorer_search_results to authenticated;
grant select, insert, update, delete on table public.catastro_explorer_reviews to authenticated;

-- Finca compartida: cualquier usuario autenticado puede leer/actualizar el snapshot.
-- No hay DELETE: la identidad la garantiza la PK, no el usuario.
drop policy if exists "Autenticado lee fincas catastro" on public.catastro_fincas;
create policy "Autenticado lee fincas catastro"
  on public.catastro_fincas for select
  to authenticated
  using (true);

drop policy if exists "Autenticado inserta fincas catastro" on public.catastro_fincas;
create policy "Autenticado inserta fincas catastro"
  on public.catastro_fincas for insert
  to authenticated
  with check (true);

drop policy if exists "Autenticado actualiza fincas catastro" on public.catastro_fincas;
create policy "Autenticado actualiza fincas catastro"
  on public.catastro_fincas for update
  to authenticated
  using (true)
  with check (true);

-- Búsqueda: solo el propietario.
drop policy if exists "Usuario lee sus busquedas catastro" on public.catastro_explorer_searches;
create policy "Usuario lee sus busquedas catastro"
  on public.catastro_explorer_searches for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuario crea sus busquedas catastro" on public.catastro_explorer_searches;
create policy "Usuario crea sus busquedas catastro"
  on public.catastro_explorer_searches for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuario actualiza sus busquedas catastro" on public.catastro_explorer_searches;
create policy "Usuario actualiza sus busquedas catastro"
  on public.catastro_explorer_searches for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuario borra sus busquedas catastro" on public.catastro_explorer_searches;
create policy "Usuario borra sus busquedas catastro"
  on public.catastro_explorer_searches for delete
  to authenticated
  using (auth.uid() = user_id);

-- Resultados: protegidos por la búsqueda propietaria.
drop policy if exists "Usuario lee resultados de sus busquedas" on public.catastro_explorer_search_results;
create policy "Usuario lee resultados de sus busquedas"
  on public.catastro_explorer_search_results for select
  to authenticated
  using (
    exists (
      select 1
      from public.catastro_explorer_searches s
      where s.id = catastro_explorer_search_results.search_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "Usuario inserta resultados de sus busquedas" on public.catastro_explorer_search_results;
create policy "Usuario inserta resultados de sus busquedas"
  on public.catastro_explorer_search_results for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.catastro_explorer_searches s
      where s.id = catastro_explorer_search_results.search_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "Usuario actualiza resultados de sus busquedas" on public.catastro_explorer_search_results;
create policy "Usuario actualiza resultados de sus busquedas"
  on public.catastro_explorer_search_results for update
  to authenticated
  using (
    exists (
      select 1
      from public.catastro_explorer_searches s
      where s.id = catastro_explorer_search_results.search_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.catastro_explorer_searches s
      where s.id = catastro_explorer_search_results.search_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "Usuario borra resultados de sus busquedas" on public.catastro_explorer_search_results;
create policy "Usuario borra resultados de sus busquedas"
  on public.catastro_explorer_search_results for delete
  to authenticated
  using (
    exists (
      select 1
      from public.catastro_explorer_searches s
      where s.id = catastro_explorer_search_results.search_id
        and s.user_id = auth.uid()
    )
  );

-- Revisión: por usuario.
drop policy if exists "Usuario lee sus revisiones catastro" on public.catastro_explorer_reviews;
create policy "Usuario lee sus revisiones catastro"
  on public.catastro_explorer_reviews for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usuario crea sus revisiones catastro" on public.catastro_explorer_reviews;
create policy "Usuario crea sus revisiones catastro"
  on public.catastro_explorer_reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Usuario actualiza sus revisiones catastro" on public.catastro_explorer_reviews;
create policy "Usuario actualiza sus revisiones catastro"
  on public.catastro_explorer_reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuario borra sus revisiones catastro" on public.catastro_explorer_reviews;
create policy "Usuario borra sus revisiones catastro"
  on public.catastro_explorer_reviews for delete
  to authenticated
  using (auth.uid() = user_id);
