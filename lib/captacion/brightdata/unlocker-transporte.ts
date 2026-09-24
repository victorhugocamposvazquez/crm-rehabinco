import type { RespuestaUnlocker } from "@/lib/captacion/brightdata/unlocker";

export const MIN_BYTES_LISTADO = 5000;
export const MAX_INTENTOS_TRANSPORTE_LISTADO = 3;

export function esErrorTransporteUnlocker(resp: RespuestaUnlocker): boolean {
  return !resp.ok || resp.bytes < MIN_BYTES_LISTADO;
}

export function motivoTransporteUnlocker(resp: RespuestaUnlocker): string {
  const hint = resp.cuerpo.replace(/\s+/g, " ").trim().slice(0, 120);
  return `transporte: HTTP ${resp.http_status} · ${resp.bytes} bytes${hint ? ` · ${hint}` : ""}`;
}
