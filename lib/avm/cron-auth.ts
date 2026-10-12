/**
 * Autenticación de cron alineada con `/api/cron/catastro-zone`
 * (`cronZonaAutorizado` en lib/catastro-host/zone-tick.ts) y con
 * `/api/captacion/brightdata/trigger` (`cronAutorizado` en lib/alertas/config.ts):
 * variable `CRON_SECRET`, cabecera `Authorization: Bearer <valor>`.
 */
export function avmCronAutorizado(request: Request): boolean {
  const esperado = process.env.CRON_SECRET?.trim();
  if (!esperado) return false;
  return request.headers.get("authorization") === `Bearer ${esperado}`;
}
