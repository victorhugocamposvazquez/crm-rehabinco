-- AVM · Referencia oficial: valor tasado (MIVAU), compraventas por municipio e IPV (INE).
-- Las series van en market_close_series (fase 1). Aquí: índice de búsqueda por zona
-- y la columna donde se guarda la referencia calculada en cada valoración.

create index if not exists market_close_series_zona_idx
  on market_close_series (zone_level, zone_key, source, period desc);

alter table avm_valuations
  add column if not exists official_reference jsonb;

comment on column avm_valuations.official_reference is
  'Referencia oficial (valor tasado MIVAU, compraventas, IPV INE) frente al €/m² estimado. Informativa: no altera el precio.';
