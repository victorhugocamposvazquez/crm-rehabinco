-- Sondeo de novedades Idealista (filtro provincia 48 h) cada 15 minutos.
-- La pasada completa diaria (04:30 UTC) sigue en captacion-idealista-listado.
-- El procesar cada 5 min vacía la cola; este cron solo encola 1 URL.

do $$
begin
  perform cron.unschedule('captacion-idealista-novedades');
exception
  when others then null;
end $$;

select cron.schedule(
  'captacion-idealista-novedades',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := replace(
      (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_trigger_url' limit 1),
      '/trigger',
      '/trigger-novedades'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'captacion_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cron$
);
