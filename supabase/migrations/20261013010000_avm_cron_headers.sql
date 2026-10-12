-- Cabecera de Authorization idéntica a captacion-idealista-listado / procesar (sin coalesce a cadena vacía).

create or replace function avm_crawl_dispatch(p_portal text, p_operation text) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name = 'avm_crawl_url' limit 1),
      'https://crm-rehabinco-two.vercel.app/api/avm/crawl'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := jsonb_build_object(
      'municipality_code', '15030',
      'portal', p_portal,
      'operation', p_operation
    ),
    timeout_milliseconds := 300000
  );
end $$;

do $$
begin
  perform cron.unschedule('avm-market-listings-weekly');
exception when others then null;
end $$;

select cron.schedule(
  'avm-market-listings-weekly',
  '0 1 * * 0',
  $cron$
  select net.http_post(
    url := coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name = 'avm_crawl_url' limit 1),
      'https://crm-rehabinco-two.vercel.app/api/avm/crawl'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
