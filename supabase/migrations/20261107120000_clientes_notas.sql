-- Historial append-only de conversaciones / notas por contacto.
create table if not exists public.clientes_notas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  texto text not null,
  tipo text not null default 'nota'
    check (tipo in ('nota', 'llamada', 'interes', 'otro')),
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_notas_cliente
  on public.clientes_notas (cliente_id, created_at desc);

comment on table public.clientes_notas is
  'Notas de conversación del contacto (una fila por conversación / día).';

alter table public.clientes_notas enable row level security;
revoke all on table public.clientes_notas from anon, public;
grant select, insert on table public.clientes_notas to authenticated;

drop policy if exists "Equipo lee notas de clientes" on public.clientes_notas;
create policy "Equipo lee notas de clientes"
  on public.clientes_notas for select
  to authenticated
  using (public.is_equipo() or public.is_editor());

drop policy if exists "Equipo escribe notas de clientes" on public.clientes_notas;
create policy "Equipo escribe notas de clientes"
  on public.clientes_notas for insert
  to authenticated
  with check (public.is_equipo());

-- Primera nota histórica desde el campo legacy clientes.notas.
insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
select
  c.id,
  null,
  trim(c.notas),
  'nota',
  coalesce(c.updated_at, c.created_at, now())
from public.clientes c
where c.notas is not null
  and length(trim(c.notas)) > 0
  and not exists (
    select 1 from public.clientes_notas n where n.cliente_id = c.id
  );
