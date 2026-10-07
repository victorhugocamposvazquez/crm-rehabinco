-- Cada persona elige de quién más quiere recibir los mismos avisos.
create table if not exists public.crm_aviso_seguir (
  user_id uuid not null references public.profiles (id) on delete cascade,
  seguido_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, seguido_id),
  constraint crm_aviso_seguir_no_uno_mismo check (user_id <> seguido_id)
);

alter table public.crm_aviso_seguir enable row level security;
revoke all on table public.crm_aviso_seguir from anon, public;
grant select, insert, delete on table public.crm_aviso_seguir to authenticated;
grant select on table public.crm_aviso_seguir to service_role;

create policy "Usuario lee a quién sigue"
  on public.crm_aviso_seguir for select
  to authenticated
  using (user_id = auth.uid());

create policy "Usuario sigue a otra persona"
  on public.crm_aviso_seguir for insert
  to authenticated
  with check (user_id = auth.uid() and user_id <> seguido_id);

create policy "Usuario deja de seguir"
  on public.crm_aviso_seguir for delete
  to authenticated
  using (user_id = auth.uid());
