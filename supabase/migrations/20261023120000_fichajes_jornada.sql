-- Registro de jornada (art. 34.9 ET). Punches y audit son append-only.

-- ---------------------------------------------------------------------------
-- Centros de trabajo
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_centros (
  id text primary key,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 150,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.fichaje_centros (id, name, address, lat, lng, radius_m)
values
  ('merced', 'Calle Merced', 'Rúa da Merced 57, 15009 A Coruña', 43.3682, -8.4039, 150),
  ('pocomaco', 'Pocomaco', 'Polígono Pocomaco, A Coruña', 43.3415, -8.4455, 200)
on conflict (id) do update set
  name = excluded.name,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  radius_m = excluded.radius_m,
  activo = true;

alter table public.fichaje_centros enable row level security;
revoke all on table public.fichaje_centros from anon, public;
grant select on table public.fichaje_centros to authenticated;

drop policy if exists "Equipo lee centros fichaje" on public.fichaje_centros;
create policy "Equipo lee centros fichaje"
  on public.fichaje_centros for select
  to authenticated
  using (public.is_equipo() or public.is_admin());

drop policy if exists "Admin gestiona centros fichaje" on public.fichaje_centros;
create policy "Admin gestiona centros fichaje"
  on public.fichaje_centros for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Festivos (A Coruña)
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_festivos (
  fecha date primary key,
  nombre text not null
);

insert into public.fichaje_festivos (fecha, nombre) values
  ('2026-01-01', 'Año Nuevo'),
  ('2026-01-06', 'Reyes'),
  ('2026-03-19', 'San José'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-05-17', 'Días das Letras Galegas'),
  ('2026-07-25', 'Santiago Apóstol'),
  ('2026-08-15', 'Asunción'),
  ('2026-10-12', 'Fiesta Nacional'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-06', 'Constitución'),
  ('2026-12-08', 'Inmaculada'),
  ('2026-12-25', 'Navidad')
on conflict (fecha) do nothing;

alter table public.fichaje_festivos enable row level security;
revoke all on table public.fichaje_festivos from anon, public;
grant select on table public.fichaje_festivos to authenticated;

drop policy if exists "Equipo lee festivos fichaje" on public.fichaje_festivos;
create policy "Equipo lee festivos fichaje"
  on public.fichaje_festivos for select
  to authenticated
  using (public.is_equipo() or public.is_admin());

drop policy if exists "Admin gestiona festivos fichaje" on public.fichaje_festivos;
create policy "Admin gestiona festivos fichaje"
  on public.fichaje_festivos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Punches (inmutables)
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  type text not null check (type in ('in', 'out', 'pause_start', 'pause_end')),
  at timestamptz not null default now(),
  client_at timestamptz,
  mode text not null check (mode in ('office', 'remote')),
  work_center_id text references public.fichaje_centros (id) on delete set null,
  lat double precision,
  lng double precision,
  accuracy double precision,
  source text not null default 'pwa',
  client_id text,
  superseded_by uuid references public.fichaje_punches (id) on delete set null,
  sequence_ok boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_fichaje_punches_client_id
  on public.fichaje_punches (user_id, client_id)
  where client_id is not null;

create index if not exists idx_fichaje_punches_user_at
  on public.fichaje_punches (user_id, at);

create index if not exists idx_fichaje_punches_day
  on public.fichaje_punches ((timezone('Europe/Madrid', at)::date), user_id);

comment on table public.fichaje_punches is
  'Fichajes append-only. Nunca UPDATE/DELETE de filas de negocio (salvo superseded_by vía función admin).';

create or replace function public.fichaje_punches_bloquear_mutacion()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'fichaje_punches es append-only: DELETE prohibido';
  end if;
  if tg_op = 'UPDATE' then
    -- Solo se permite marcar superseded_by (y sequence_ok ya fijado al insertar).
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.type is distinct from old.type
      or new.at is distinct from old.at
      or new.client_at is distinct from old.client_at
      or new.mode is distinct from old.mode
      or new.work_center_id is distinct from old.work_center_id
      or new.lat is distinct from old.lat
      or new.lng is distinct from old.lng
      or new.accuracy is distinct from old.accuracy
      or new.source is distinct from old.source
      or new.client_id is distinct from old.client_id
      or new.created_at is distinct from old.created_at
      or new.sequence_ok is distinct from old.sequence_ok
    then
      raise exception 'fichaje_punches es append-only: solo se puede actualizar superseded_by';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fichaje_punches_bloquear on public.fichaje_punches;
create trigger trg_fichaje_punches_bloquear
  before update or delete on public.fichaje_punches
  for each row execute function public.fichaje_punches_bloquear_mutacion();

alter table public.fichaje_punches enable row level security;
revoke all on table public.fichaje_punches from anon, public;
grant select, insert, update on table public.fichaje_punches to authenticated;
-- UPDATE solo superseded_by (trigger + policy admin); service_role bypasea RLS

drop policy if exists "Empleado lee sus punches" on public.fichaje_punches;
create policy "Empleado lee sus punches"
  on public.fichaje_punches for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Empleado inserta sus punches" on public.fichaje_punches;
create policy "Empleado inserta sus punches"
  on public.fichaje_punches for insert
  to authenticated
  with check (
    (user_id = auth.uid() and (public.is_equipo() or public.is_admin()))
    or public.is_admin()
  );

drop policy if exists "Admin actualiza superseded punches" on public.fichaje_punches;
create policy "Admin actualiza superseded punches"
  on public.fichaje_punches for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Correcciones
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  date date not null,
  type text not null check (type in ('in', 'out', 'pause_start', 'pause_end')),
  original_punch_id uuid references public.fichaje_punches (id) on delete set null,
  proposed_at timestamptz not null,
  reason text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resulting_punch_id uuid references public.fichaje_punches (id) on delete set null
);

create index if not exists idx_fichaje_corrections_status
  on public.fichaje_corrections (status, requested_at desc);

create index if not exists idx_fichaje_corrections_user_date
  on public.fichaje_corrections (user_id, date);

alter table public.fichaje_corrections enable row level security;
revoke all on table public.fichaje_corrections from anon, public;
grant select, insert, update on table public.fichaje_corrections to authenticated;

drop policy if exists "Empleado ve sus correcciones" on public.fichaje_corrections;
create policy "Empleado ve sus correcciones"
  on public.fichaje_corrections for select
  to authenticated
  using (user_id = auth.uid() or requested_by = auth.uid() or public.is_admin());

drop policy if exists "Empleado solicita correccion" on public.fichaje_corrections;
create policy "Empleado solicita correccion"
  on public.fichaje_corrections for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    and user_id = auth.uid()
    and (public.is_equipo() or public.is_admin())
  );

drop policy if exists "Admin crea correccion directa" on public.fichaje_corrections;
create policy "Admin crea correccion directa"
  on public.fichaje_corrections for insert
  to authenticated
  with check (public.is_admin() and requested_by = auth.uid());

drop policy if exists "Admin resuelve correcciones" on public.fichaje_corrections;
create policy "Admin resuelve correcciones"
  on public.fichaje_corrections for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Resúmenes mensuales
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  days integer not null default 0,
  ordinary_min integer not null default 0,
  extra_min integer not null default 0,
  extra_compensation text check (extra_compensation is null or extra_compensation in ('rest', 'pay')),
  remote_days integer not null default 0,
  pdf_path text,
  generated_at timestamptz not null default now(),
  signed_at timestamptz,
  signature_ip text,
  signature_ua text,
  unique (user_id, month)
);

alter table public.fichaje_monthly_summaries enable row level security;
revoke all on table public.fichaje_monthly_summaries from anon, public;
grant select, insert, update on table public.fichaje_monthly_summaries to authenticated;

drop policy if exists "Empleado ve sus resúmenes" on public.fichaje_monthly_summaries;
create policy "Empleado ve sus resúmenes"
  on public.fichaje_monthly_summaries for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Empleado firma su resumen" on public.fichaje_monthly_summaries;
create policy "Empleado firma su resumen"
  on public.fichaje_monthly_summaries for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admin genera resúmenes" on public.fichaje_monthly_summaries;
create policy "Admin genera resúmenes"
  on public.fichaje_monthly_summaries for insert
  to authenticated
  with check (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auditoría append-only
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_label text not null default '',
  action text not null,
  detail text not null default '',
  origin text not null default 'servidor',
  prev_hash text,
  hash text
);

create index if not exists idx_fichaje_audit_at on public.fichaje_audit_log (at desc);

create or replace function public.fichaje_audit_bloquear_mutacion()
returns trigger
language plpgsql
as $$
begin
  raise exception 'fichaje_audit_log es append-only';
end;
$$;

drop trigger if exists trg_fichaje_audit_bloquear on public.fichaje_audit_log;
create trigger trg_fichaje_audit_bloquear
  before update or delete on public.fichaje_audit_log
  for each row execute function public.fichaje_audit_bloquear_mutacion();

alter table public.fichaje_audit_log enable row level security;
revoke all on table public.fichaje_audit_log from anon, public;
grant select, insert on table public.fichaje_audit_log to authenticated;

drop policy if exists "Admin lee auditoria fichaje" on public.fichaje_audit_log;
create policy "Admin lee auditoria fichaje"
  on public.fichaje_audit_log for select
  to authenticated
  using (public.is_admin() or actor_id = auth.uid());

drop policy if exists "Equipo escribe auditoria fichaje" on public.fichaje_audit_log;
create policy "Equipo escribe auditoria fichaje"
  on public.fichaje_audit_log for insert
  to authenticated
  with check (public.is_equipo() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Protocolo documentado (PDF)
-- ---------------------------------------------------------------------------

create table if not exists public.fichaje_protocolo (
  id integer primary key default 1 check (id = 1),
  pdf_path text,
  uploaded_at timestamptz,
  uploaded_by uuid references public.profiles (id) on delete set null
);

insert into public.fichaje_protocolo (id) values (1) on conflict (id) do nothing;

alter table public.fichaje_protocolo enable row level security;
revoke all on table public.fichaje_protocolo from anon, public;
grant select, update on table public.fichaje_protocolo to authenticated;

drop policy if exists "Equipo lee protocolo fichaje" on public.fichaje_protocolo;
create policy "Equipo lee protocolo fichaje"
  on public.fichaje_protocolo for select
  to authenticated
  using (public.is_equipo() or public.is_admin());

drop policy if exists "Admin sube protocolo fichaje" on public.fichaje_protocolo;
create policy "Admin sube protocolo fichaje"
  on public.fichaje_protocolo for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Bucket para PDFs de fichaje (protocolo + resúmenes)
insert into storage.buckets (id, name, public)
values ('fichajes', 'fichajes', false)
on conflict (id) do nothing;

drop policy if exists "Equipo lee fichajes storage" on storage.objects;
create policy "Equipo lee fichajes storage"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fichajes' and (public.is_equipo() or public.is_admin()));

drop policy if exists "Admin escribe fichajes storage" on storage.objects;
create policy "Admin escribe fichajes storage"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'fichajes' and public.is_admin());

drop policy if exists "Admin actualiza fichajes storage" on storage.objects;
create policy "Admin actualiza fichajes storage"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fichajes' and public.is_admin())
  with check (bucket_id = 'fichajes' and public.is_admin());
