import type { RespuestaUnlocker } from "@/lib/captacion/brightdata/unlocker";

/** JSON ~100 B con phone1; no aplica el mínimo de bytes del listado HTML. */
export function esRespuestaTelefonoUnlockerValida(resp: RespuestaUnlocker): boolean {
  if (!resp.ok || resp.http_status < 200 || resp.http_status >= 300) return false;
  const limpio = resp.cuerpo.trim();
  if (!limpio || /access denied|captcha|<html|<!doctype/i.test(limpio.slice(0, 200))) return false;
  try {
    const json = JSON.parse(limpio) as unknown;
    return Boolean(json && typeof json === "object" && !Array.isArray(json) && "phone1" in json);
  } catch {
    return false;
  }
}

export function motivoFalloTelefonoUnlocker(resp: RespuestaUnlocker): string {
  const hint = resp.cuerpo.replace(/\s+/g, " ").trim().slice(0, 120);
  return `telefono: HTTP ${resp.http_status} · ${resp.bytes} bytes${hint ? ` · ${hint}` : ""}`;
}
