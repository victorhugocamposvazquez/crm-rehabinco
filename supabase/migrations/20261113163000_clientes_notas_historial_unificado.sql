-- Unificación de notas e historial de contactos entre clientes_notas, tareas_actividad y citas.
-- 1. Asegura FK de clientes_notas.actor_id -> public.profiles(id) para joins en PostgREST.
-- 2. Recupera el autor (actor_id) en notas históricas de contactos y tareas.
-- 3. Copia notas de tareas/citas al historial del contacto (clientes_notas) y viceversa.
-- 4. Mantiene sincronizadas en tiempo real las notas escritas desde Contactos, Calendario o Tareas.

alter table public.clientes_notas
  drop constraint if exists clientes_notas_actor_id_fkey;

alter table public.clientes_notas
  add constraint clientes_notas_actor_id_fkey
  foreign key (actor_id) references public.profiles (id) on delete set null;

-- Asegura que cualquier nota legacy en clientes.notas esté en clientes_notas con su creador.
insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
select
  c.id,
  case when exists (select 1 from public.profiles p where p.id = c.user_id) then c.user_id else null end,
  trim(c.notas),
  'nota',
  coalesce(c.created_at, c.updated_at, now())
from public.clientes c
where c.notas is not null
  and length(trim(c.notas)) > 0
  and not exists (
    select 1 from public.clientes_notas n
    where n.cliente_id = c.id
      and trim(n.texto) = trim(c.notas)
  );

-- Rellena actor_id en clientes_notas cuando quedó a null en la migración inicial.
update public.clientes_notas n
set actor_id = c.user_id
from public.clientes c
where n.cliente_id = c.id
  and n.actor_id is null
  and c.user_id is not null
  and exists (select 1 from public.profiles p where p.id = c.user_id);

-- Rellena actor_id en tareas_actividad cuando se copió desde clientes_notas sin autor.
update public.tareas_actividad ta
set actor_id = cn.actor_id
from public.tareas t
join public.clientes_notas cn
  on cn.cliente_id = t.cliente_id
where ta.tarea_id = t.id
  and ta.actor_id is null
  and cn.actor_id is not null
  and trim(ta.texto) = trim(cn.texto);

update public.tareas_actividad ta
set actor_id = coalesce(t.creado_por, t.comercial_id)
from public.tareas t
where ta.tarea_id = t.id
  and ta.actor_id is null
  and coalesce(t.creado_por, t.comercial_id) is not null
  and exists (
    select 1 from public.profiles p where p.id = coalesce(t.creado_por, t.comercial_id)
  );

-- Volcar notas de tareas_actividad a clientes_notas cuando la tarea tiene cliente_id.
insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
select distinct on (t.cliente_id, trim(ta.texto))
  t.cliente_id,
  case
    when ta.actor_id is not null and exists (select 1 from public.profiles p where p.id = ta.actor_id) then ta.actor_id
    when t.creado_por is not null and exists (select 1 from public.profiles p where p.id = t.creado_por) then t.creado_por
    when t.comercial_id is not null and exists (select 1 from public.profiles p where p.id = t.comercial_id) then t.comercial_id
    else null
  end,
  trim(ta.texto),
  case when ci.tipo = 'llamada' then 'llamada' else 'nota' end,
  ta.created_at
from public.tareas_actividad ta
join public.tareas t on t.id = ta.tarea_id
left join public.citas ci on ci.id = t.cita_id
where t.cliente_id is not null
  and ta.tipo = 'nota'
  and length(trim(ta.texto)) > 0
  and trim(ta.texto) <> 'Reabierta'
  and trim(ta.texto) not like 'Reagendada%'
  and not exists (
    select 1 from public.clientes_notas cn
    where cn.cliente_id = t.cliente_id
      and trim(cn.texto) = trim(ta.texto)
  )
order by t.cliente_id, trim(ta.texto), ta.created_at asc;

-- Volcar notas de citas a clientes_notas cuando la cita tiene cliente_id.
insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
select distinct on (c.cliente_id, trim(c.notas))
  c.cliente_id,
  case
    when c.comercial_id is not null and exists (select 1 from public.profiles p where p.id = c.comercial_id) then c.comercial_id
    else null
  end,
  trim(c.notas),
  case when c.tipo = 'llamada' then 'llamada' else 'nota' end,
  coalesce(c.created_at, now())
from public.citas c
where c.cliente_id is not null
  and c.notas is not null
  and length(trim(c.notas)) > 0
  and not exists (
    select 1 from public.clientes_notas cn
    where cn.cliente_id = c.cliente_id
      and trim(cn.texto) = trim(c.notas)
  )
order by c.cliente_id, trim(c.notas), c.created_at asc;

-- Volcar notas de clientes_notas hacia tareas_actividad de tareas vinculadas al contacto.
insert into public.tareas_actividad (tarea_id, actor_id, tipo, texto, created_at)
select
  t.id,
  cn.actor_id,
  'nota',
  trim(cn.texto),
  cn.created_at
from public.tareas t
join public.clientes_notas cn on cn.cliente_id = t.cliente_id
where t.cliente_id is not null
  and length(trim(cn.texto)) > 0
  and not exists (
    select 1 from public.tareas_actividad ta
    where ta.tarea_id = t.id
      and trim(ta.texto) = trim(cn.texto)
  );

-- Triggers de sincronización bidireccional entre tareas_actividad y clientes_notas.
create or replace function public.fn_sync_tarea_actividad_a_cliente_nota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_comercial_id uuid;
  v_creado_por uuid;
  v_cita_tipo text;
  v_actor uuid;
  v_texto text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.tipo is distinct from 'nota' then
    return new;
  end if;

  v_texto := trim(coalesce(new.texto, ''));
  if v_texto = '' or v_texto = 'Reabierta' or v_texto like 'Reagendada%' then
    return new;
  end if;

  select t.cliente_id, t.comercial_id, t.creado_por, ci.tipo
    into v_cliente_id, v_comercial_id, v_creado_por, v_cita_tipo
  from public.tareas t
  left join public.citas ci on ci.id = t.cita_id
  where t.id = new.tarea_id;

  if v_cliente_id is null then
    return new;
  end if;

  v_actor := coalesce(new.actor_id, auth.uid(), v_creado_por, v_comercial_id);
  if v_actor is not null and not exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'UPDATE' and old.texto is distinct from new.texto then
    update public.clientes_notas
    set texto = v_texto
    where cliente_id = v_cliente_id
      and trim(texto) = trim(coalesce(old.texto, ''));
  end if;

  if not exists (
    select 1 from public.clientes_notas cn
    where cn.cliente_id = v_cliente_id
      and trim(cn.texto) = v_texto
  ) then
    insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
    values (
      v_cliente_id,
      v_actor,
      v_texto,
      case when v_cita_tipo = 'llamada' then 'llamada' else 'nota' end,
      coalesce(new.created_at, now())
    );
  end if;

  -- Propaga también a otras tareas del mismo contacto para que todas tengan el hilo completo.
  insert into public.tareas_actividad (tarea_id, actor_id, tipo, texto, created_at)
  select
    t2.id,
    v_actor,
    'nota',
    v_texto,
    coalesce(new.created_at, now())
  from public.tareas t2
  where t2.cliente_id = v_cliente_id
    and t2.id <> new.tarea_id
    and not exists (
      select 1 from public.tareas_actividad ta2
      where ta2.tarea_id = t2.id
        and trim(ta2.texto) = v_texto
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_tarea_actividad_a_cliente_nota on public.tareas_actividad;
create trigger trg_sync_tarea_actividad_a_cliente_nota
  after insert or update of texto on public.tareas_actividad
  for each row
  execute function public.fn_sync_tarea_actividad_a_cliente_nota();

create or replace function public.fn_sync_cliente_nota_a_tareas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text;
  v_actor uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_texto := trim(coalesce(new.texto, ''));
  if v_texto = '' then
    return new;
  end if;

  v_actor := coalesce(new.actor_id, auth.uid());
  if v_actor is not null and not exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor := null;
  end if;

  if tg_op = 'UPDATE' and old.texto is distinct from new.texto then
    update public.tareas_actividad ta
    set texto = v_texto
    from public.tareas t
    where ta.tarea_id = t.id
      and t.cliente_id = new.cliente_id
      and ta.tipo = 'nota'
      and trim(ta.texto) = trim(coalesce(old.texto, ''));
  end if;

  insert into public.tareas_actividad (tarea_id, actor_id, tipo, texto, created_at)
  select
    t.id,
    v_actor,
    'nota',
    v_texto,
    coalesce(new.created_at, now())
  from public.tareas t
  where t.cliente_id = new.cliente_id
    and not exists (
      select 1 from public.tareas_actividad ta
      where ta.tarea_id = t.id
        and trim(ta.texto) = v_texto
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_cliente_nota_a_tareas on public.clientes_notas;
create trigger trg_sync_cliente_nota_a_tareas
  after insert or update of texto on public.clientes_notas
  for each row
  execute function public.fn_sync_cliente_nota_a_tareas();

create or replace function public.fn_sync_tarea_al_vincular_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.cliente_id is null then
    return new;
  end if;

  -- Copia notas del contacto a la tarea recién vinculada.
  insert into public.tareas_actividad (tarea_id, actor_id, tipo, texto, created_at)
  select
    new.id,
    cn.actor_id,
    'nota',
    trim(cn.texto),
    cn.created_at
  from public.clientes_notas cn
  where cn.cliente_id = new.cliente_id
    and length(trim(cn.texto)) > 0
    and not exists (
      select 1 from public.tareas_actividad ta
      where ta.tarea_id = new.id
        and trim(ta.texto) = trim(cn.texto)
    );

  -- Y copia notas que ya tuviera la tarea hacia el contacto.
  insert into public.clientes_notas (cliente_id, actor_id, texto, tipo, created_at)
  select
    new.cliente_id,
    coalesce(ta.actor_id, new.creado_por, new.comercial_id),
    trim(ta.texto),
    'nota',
    ta.created_at
  from public.tareas_actividad ta
  where ta.tarea_id = new.id
    and ta.tipo = 'nota'
    and length(trim(ta.texto)) > 0
    and trim(ta.texto) <> 'Reabierta'
    and trim(ta.texto) not like 'Reagendada%'
    and not exists (
      select 1 from public.clientes_notas cn
      where cn.cliente_id = new.cliente_id
        and trim(cn.texto) = trim(ta.texto)
    );

  return new;
end;
$$;

drop trigger if exists trg_sync_tarea_al_vincular_cliente on public.tareas;
create trigger trg_sync_tarea_al_vincular_cliente
  after insert or update of cliente_id on public.tareas
  for each row
  execute function public.fn_sync_tarea_al_vincular_cliente();

notify pgrst, 'reload schema';
