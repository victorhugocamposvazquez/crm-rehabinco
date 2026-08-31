-- Emisores de presupuesto (Rehabinco / Garal), branding de cliente y FK en presupuestos
-- -----------------------------------------------------------------------------

create table if not exists public.emisores_presupuesto (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre_corto text not null,
  razon_social text not null default '',
  nif text not null default '',
  direccion text not null default '',
  codigo_postal text not null default '',
  localidad text not null default '',
  provincia text not null default '',
  telefono text,
  email text,
  iban text,
  numero_cuenta_bancaria text,
  logo_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emisores_presupuesto_slug_check check (slug in ('rehabinco', 'garal'))
);

comment on table public.emisores_presupuesto is
  'Emisores seleccionables al crear presupuestos (logo y datos fiscales). Independiente de empresa_facturacion.';

create or replace function public.set_emisores_presupuesto_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_emisores_presupuesto_updated on public.emisores_presupuesto;
create trigger trg_emisores_presupuesto_updated
  before update on public.emisores_presupuesto
  for each row execute function public.set_emisores_presupuesto_updated_at();

-- Semilla Rehabinco: copiar empresa_facturacion si hay datos; si no, partes de visita
insert into public.emisores_presupuesto (
  slug,
  nombre_corto,
  razon_social,
  nif,
  direccion,
  codigo_postal,
  localidad,
  provincia,
  telefono,
  email,
  iban,
  numero_cuenta_bancaria,
  logo_url
)
select
  'rehabinco',
  'Rehabinco S.L.',
  coalesce(nullif(trim(ef.razon_social), ''), 'REHABINCO, S.L.'),
  coalesce(nullif(trim(ef.nif), ''), 'B22834005'),
  coalesce(nullif(trim(ef.direccion), ''), 'Rúa da Merced nº 57, Bajo'),
  coalesce(nullif(trim(ef.codigo_postal), ''), '15009'),
  coalesce(nullif(trim(ef.localidad), ''), 'A Coruña'),
  coalesce(nullif(trim(ef.provincia), ''), 'A Coruña'),
  ef.telefono,
  ef.email,
  ef.iban,
  ef.numero_cuenta_bancaria,
  ef.logo_url
from (select 1) as dummy
left join public.empresa_facturacion ef on ef.id = 1
on conflict (slug) do nothing;

insert into public.emisores_presupuesto (
  slug,
  nombre_corto,
  razon_social,
  nif,
  direccion,
  codigo_postal,
  localidad,
  provincia
)
values (
  'garal',
  'Garal',
  'Garal',
  '',
  '',
  '',
  '',
  ''
)
on conflict (slug) do nothing;

alter table public.emisores_presupuesto enable row level security;

drop policy if exists "Lectura emisores presupuesto (autenticados)" on public.emisores_presupuesto;
create policy "Lectura emisores presupuesto (autenticados)"
  on public.emisores_presupuesto for select
  to authenticated
  using (true);

drop policy if exists "Admin gestión emisores presupuesto" on public.emisores_presupuesto;
create policy "Admin gestión emisores presupuesto"
  on public.emisores_presupuesto for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.emisor_presupuesto_rehabinco_id()
returns uuid
language sql
stable
as $$
  select id from public.emisores_presupuesto where slug = 'rehabinco' limit 1;
$$;

alter table public.presupuestos
  add column if not exists emisor_id uuid references public.emisores_presupuesto (id);

update public.presupuestos p
set emisor_id = e.id
from public.emisores_presupuesto e
where e.slug = 'rehabinco'
  and p.emisor_id is null;

alter table public.presupuestos
  alter column emisor_id set default public.emisor_presupuesto_rehabinco_id();

do $$
begin
  if exists (
    select 1 from public.emisores_presupuesto where slug = 'rehabinco'
  ) and not exists (
    select 1 from public.presupuestos where emisor_id is null
  ) then
    alter table public.presupuestos alter column emisor_id set not null;
  end if;
end $$;

create index if not exists presupuestos_emisor_id_idx on public.presupuestos (emisor_id);

alter table public.clientes
  add column if not exists presupuesto_logo_url text;

alter table public.clientes
  add column if not exists presupuesto_cabecera_url text;

alter table public.clientes
  add column if not exists plantilla_presupuesto text;

alter table public.clientes
  drop constraint if exists clientes_plantilla_presupuesto_check;

alter table public.clientes
  add constraint clientes_plantilla_presupuesto_check
  check (plantilla_presupuesto is null or plantilla_presupuesto = 'deportivo');

comment on column public.clientes.presupuesto_logo_url is
  'URL o ruta /... del logotipo del cliente en PDFs de presupuesto maquetados.';
comment on column public.clientes.presupuesto_cabecera_url is
  'URL o ruta /... de la franja de cabecera del cliente en PDFs de presupuesto.';
comment on column public.clientes.plantilla_presupuesto is
  'Plantilla nombrada (deportivo) o null = automática según cabecera/logo.';
