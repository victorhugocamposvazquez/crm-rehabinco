-- Una sola pasada diaria del listado: 04:30 UTC.

do $$
begin
  perform cron.unschedule('captacion-idealista-listado');
exception
  when others then null;
end $$;

select cron.schedule(
  'captacion-idealista-listado',
  '30 4 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_trigger_url' limit 1),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
