alter table avm_valuations
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists avm_valuations_papelera_idx
  on avm_valuations (tenant_id, deleted_at desc)
  where deleted_at is not null;
