-- Marca del informe PDF por agencia y bucket privado de los PDF generados.

create table if not exists public.agency_branding (
  tenant_id        uuid primary key references public.tenants(id) on delete cascade,
  name             text not null,
  logo_light_path  text,
  logo_dark_path   text,
  color            text not null default '#121214',
  pdf_theme        text not null default 'light' check (pdf_theme in ('light', 'dark')),
  phone            text,
  email            text,
  web              text,
  updated_at       timestamptz not null default now()
);

alter table public.agency_branding enable row level security;

drop policy if exists agency_branding_read on public.agency_branding;
create policy agency_branding_read on public.agency_branding
  for select to authenticated
  using (tenant_id = public.avm_current_tenant());

drop policy if exists agency_branding_write on public.agency_branding;
create policy agency_branding_write on public.agency_branding
  for all to authenticated
  using (tenant_id = public.avm_current_tenant() and public.is_admin())
  with check (tenant_id = public.avm_current_tenant() and public.is_admin());

insert into public.agency_branding (
  tenant_id, name, logo_light_path, logo_dark_path, color, pdf_theme, phone, email, web
)
values (
  '00000000-0000-4000-8000-000000000001',
  'REHABINCO, S.L.',
  '/images/logo-web.png',
  '/images/facturas/rehabinco-blanco.png',
  '#ffffff',
  'dark',
  '664 859 306',
  'oficina@rehabinco.com',
  'www.rehabinco.com'
)
on conflict (tenant_id) do update set
  name = excluded.name,
  logo_light_path = excluded.logo_light_path,
  logo_dark_path = excluded.logo_dark_path,
  color = excluded.color,
  pdf_theme = excluded.pdf_theme,
  phone = excluded.phone,
  email = excluded.email,
  web = excluded.web,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit)
values ('avm-reports', 'avm-reports', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists avm_reports_select on storage.objects;
create policy avm_reports_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avm-reports'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
  );

drop policy if exists avm_reports_insert on storage.objects;
create policy avm_reports_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avm-reports'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  );

drop policy if exists avm_reports_update on storage.objects;
create policy avm_reports_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avm-reports'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  )
  with check (
    bucket_id = 'avm-reports'
    and (storage.foldername(name))[1] = public.avm_current_tenant()::text
    and public.is_admin()
  );
