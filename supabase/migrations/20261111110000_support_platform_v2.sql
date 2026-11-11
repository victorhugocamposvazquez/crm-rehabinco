-- Evolución del sistema de soporte:
-- 1. Control manual de empresas adheridas y plan de pago activo (preparado para futuro Stripe).
-- 2. Motor de resolución desacoplado (manual, solo_triaje_ia, cursor_cloud, github_issue, webhook_externo) + tope semanal.
-- 3. Flujo de validación por el usuario (pendiente_confirmacion, reabierto, en_curso_manual) y resolución manual.
-- 4. Cola auditable de correos transaccionales (Brevo) para que un fallo de email nunca tumbe un ticket.

alter table public.support_settings
  add column if not exists empresa_nombre text not null default 'Rehabinco',
  add column if not exists estado_adhesion text not null default 'aceptada'
    check (estado_adhesion in ('pendiente', 'aceptada', 'rechazada', 'suspendida')),
  add column if not exists aceptada_en timestamptz,
  add column if not exists aceptada_por uuid references auth.users (id) on delete set null,
  add column if not exists plan_activo boolean not null default true,
  add column if not exists plan_nombre text not null default 'Soporte Activo (Manual)',
  add column if not exists plan_vence_en date,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists solver_provider text not null default 'solo_triaje_ia'
    check (solver_provider in ('manual', 'solo_triaje_ia', 'cursor_cloud', 'github_issue', 'webhook_externo')),
  add column if not exists solver_webhook_url text,
  add column if not exists max_agent_runs_per_week integer not null default 10
    check (max_agent_runs_per_week >= 0 and max_agent_runs_per_week <= 500),
  add column if not exists support_inbox_email text,
  add column if not exists brevo_sender_email text,
  add column if not exists brevo_sender_name text not null default 'Soporte CRM',
  add column if not exists notify_admin_on_new boolean not null default true,
  add column if not exists notify_user_on_updates boolean not null default true;

update public.support_settings
set empresa_nombre = coalesce(nullif(empresa_nombre, ''), 'Rehabinco'),
    estado_adhesion = 'aceptada',
    plan_activo = true
where project_key = 'rehabinco';

create or replace function public.support_empresa_activa(p_project_key text default 'rehabinco')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_settings s
    where s.project_key = coalesce(nullif(p_project_key, ''), 'rehabinco')
      and s.estado_adhesion = 'aceptada'
      and s.plan_activo = true
      and (s.plan_vence_en is null or s.plan_vence_en >= current_date)
  );
$$;

revoke all on function public.support_empresa_activa(text) from public, anon;
grant execute on function public.support_empresa_activa(text) to authenticated, service_role;

-- Actualizar check de estados de support_tickets para cubrir flujo manual y confirmación del usuario
do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'support_tickets'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%estado%'
  ) loop
    execute format('alter table public.support_tickets drop constraint if exists %I', r.conname);
  end loop;
end;
$$;

alter table public.support_tickets
  add constraint support_tickets_estado_check
  check (estado in (
    'nuevo',
    'triaje',
    'en_curso_manual',
    'esperando_usuario',
    'respondido_ia',
    'agente_trabajando',
    'pr_revision',
    'pendiente_confirmacion',
    'reabierto',
    'resuelto',
    'escalado_humano',
    'cerrado'
  ));

alter table public.support_tickets
  add column if not exists solver_provider text,
  add column if not exists external_issue_url text,
  add column if not exists solucion_resumen text,
  add column if not exists solucion_propuesta_en timestamptz,
  add column if not exists resuelto_en timestamptz,
  add column if not exists resuelto_por text
    check (resuelto_por is null or resuelto_por in ('usuario', 'superadmin', 'auto_inactividad')),
  add column if not exists reabierto_veces integer not null default 0;

-- Actualizar autor_tipo de mensajes para admitir cualquier proveedor externo, no solo Cursor
do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'support_ticket_messages'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%autor_tipo%'
  ) loop
    execute format('alter table public.support_ticket_messages drop constraint if exists %I', r.conname);
  end loop;
end;
$$;

alter table public.support_ticket_messages
  add constraint support_ticket_messages_autor_tipo_check
  check (autor_tipo in ('usuario', 'ia', 'agente_codigo', 'agente_cursor', 'superadmin', 'sistema'));

-- Reforzar política de creación de tickets: requiere empresa adherida y plan activo (o superadmin)
drop policy if exists "Usuario crea sus tickets soporte" on public.support_tickets;
create policy "Usuario crea sus tickets soporte"
  on public.support_tickets for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and auto_merge_permitido = false
    and (public.is_superadmin() or public.support_empresa_activa(project_key))
  );

-- Cola y registro auditable de correos transaccionales (Brevo)
create table if not exists public.support_email_outbox (
  id uuid primary key default gen_random_uuid(),
  project_key text not null default 'rehabinco',
  ticket_id uuid references public.support_tickets (id) on delete set null,
  destinatario_email text not null,
  destinatario_tipo text not null default 'usuario'
    check (destinatario_tipo in ('usuario', 'soporte', 'prueba')),
  evento text not null,
  asunto text not null,
  cuerpo_html text not null,
  cuerpo_texto text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'entregado', 'rebote', 'bloqueado', 'error')),
  intentos integer not null default 0,
  brevo_message_id text,
  ultimo_error text,
  ultimo_evento_brevo text,
  enviado_en timestamptz,
  entregado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_email_outbox is
  'Registro y cola de alertas por correo de soporte (Brevo). Garantiza que el fallo del correo nunca rompa el ticket.';

create index if not exists idx_support_email_outbox_created
  on public.support_email_outbox (project_key, created_at desc);

create index if not exists idx_support_email_outbox_estado
  on public.support_email_outbox (estado, created_at desc);

create index if not exists idx_support_email_outbox_msg
  on public.support_email_outbox (brevo_message_id)
  where brevo_message_id is not null;

alter table public.support_email_outbox enable row level security;
revoke all on table public.support_email_outbox from anon, public;
grant select, insert, update, delete on public.support_email_outbox to authenticated;

drop policy if exists "Superadmin gestiona outbox soporte" on public.support_email_outbox;
create policy "Superadmin gestiona outbox soporte"
  on public.support_email_outbox for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());
