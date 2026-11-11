-- Sistema autónomo y exportable de tickets de soporte.
-- Aislado por project_key para reutilizarlo o extraerlo a un hub multi-CRM.

create sequence if not exists public.support_ticket_seq start 1;

create table if not exists public.support_settings (
  project_key text primary key,
  cursor_model text not null default 'composer-2.5'
    check (cursor_model in ('composer-2.5', 'auto')),
  auto_merge_enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.support_settings is
  'Ajustes operativos del motor autónomo de soporte por proyecto CRM.';

insert into public.support_settings (project_key, cursor_model, auto_merge_enabled)
values ('rehabinco', 'composer-2.5', true)
on conflict (project_key) do nothing;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  project_key text not null default 'rehabinco',
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  user_role text,
  titulo text not null,
  descripcion text not null,
  modulo text,
  categoria text not null default 'duda'
    check (categoria in ('duda', 'bug', 'datos', 'mejora')),
  riesgo text not null default 'cero'
    check (riesgo in ('cero', 'bajo', 'alto')),
  estado text not null default 'nuevo'
    check (estado in (
      'nuevo',
      'triaje',
      'respondido_ia',
      'agente_trabajando',
      'pr_revision',
      'resuelto',
      'escalado_humano',
      'cerrado'
    )),
  contexto jsonb not null default '{}'::jsonb,
  cursor_agent_id text,
  cursor_run_id text,
  github_branch text,
  github_pr_number integer,
  github_pr_url text,
  vercel_preview_url text,
  auto_merge_permitido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_tickets is
  'Incidencias y consultas de soporte con telemetría automática y trazabilidad Cursor/GitHub.';

create or replace function public.support_tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo is null or btrim(new.codigo) = '' then
    new.codigo := 'SUP-' || lpad(nextval('public.support_ticket_seq')::text, 4, '0');
  end if;
  if new.updated_at is null then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.support_tickets_before_insert() from public, anon, authenticated;

drop trigger if exists trg_support_tickets_before_insert on public.support_tickets;
create trigger trg_support_tickets_before_insert
  before insert on public.support_tickets
  for each row
  execute function public.support_tickets_before_insert();

create index if not exists idx_support_tickets_user
  on public.support_tickets (user_id, updated_at desc);

create index if not exists idx_support_tickets_estado
  on public.support_tickets (project_key, estado, updated_at desc);

create index if not exists idx_support_tickets_pr
  on public.support_tickets (github_pr_number)
  where github_pr_number is not null;

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  autor_tipo text not null
    check (autor_tipo in ('usuario', 'ia', 'agente_cursor', 'superadmin')),
  cuerpo text not null,
  adjuntos jsonb not null default '[]'::jsonb,
  interno boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.support_ticket_messages is
  'Hilo de conversación de cada ticket de soporte. Los mensajes internos solo los ve superadmin.';

create index if not exists idx_support_ticket_messages_ticket
  on public.support_ticket_messages (ticket_id, created_at asc);

alter table public.support_settings enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

revoke all on table public.support_settings from anon, public;
revoke all on table public.support_tickets from anon, public;
revoke all on table public.support_ticket_messages from anon, public;

grant select, insert, update on table public.support_settings to authenticated;
grant select, insert, update, delete on table public.support_tickets to authenticated;
grant select, insert, update, delete on table public.support_ticket_messages to authenticated;
grant usage, select on sequence public.support_ticket_seq to authenticated, service_role;

drop policy if exists "Superadmin gestiona ajustes soporte" on public.support_settings;
create policy "Superadmin gestiona ajustes soporte"
  on public.support_settings for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Superadmin gestiona tickets soporte" on public.support_tickets;
create policy "Superadmin gestiona tickets soporte"
  on public.support_tickets for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Usuario lee sus tickets soporte" on public.support_tickets;
create policy "Usuario lee sus tickets soporte"
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Usuario crea sus tickets soporte" on public.support_tickets;
create policy "Usuario crea sus tickets soporte"
  on public.support_tickets for insert
  to authenticated
  with check (user_id = auth.uid() and auto_merge_permitido = false);

drop policy if exists "Superadmin gestiona mensajes soporte" on public.support_ticket_messages;
create policy "Superadmin gestiona mensajes soporte"
  on public.support_ticket_messages for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists "Usuario lee mensajes publicos de sus tickets" on public.support_ticket_messages;
create policy "Usuario lee mensajes publicos de sus tickets"
  on public.support_ticket_messages for select
  to authenticated
  using (
    interno = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Usuario escribe en sus tickets" on public.support_ticket_messages;
create policy "Usuario escribe en sus tickets"
  on public.support_ticket_messages for insert
  to authenticated
  with check (
    interno = false
    and autor_tipo = 'usuario'
    and user_id = auth.uid()
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support_attachments_superadmin_all" on storage.objects;
create policy "support_attachments_superadmin_all"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'support-attachments' and public.is_superadmin())
  with check (bucket_id = 'support-attachments' and public.is_superadmin());

drop policy if exists "support_attachments_user_select" on storage.objects;
create policy "support_attachments_user_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "support_attachments_user_insert" on storage.objects;
create policy "support_attachments_user_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.crm_aviso_prefs
  add column if not exists soporte boolean not null default true;

comment on column public.crm_aviso_prefs.soporte is
  'Avisos en la app y push sobre respuestas y cierres de tickets de soporte.';
