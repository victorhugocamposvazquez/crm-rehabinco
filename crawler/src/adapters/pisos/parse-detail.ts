import { normalizarTelefono } from "../../../../lib/captacion/pipeline/normalize.js";

function telefonoDesdeHtml(body: string): string | undefined {
  const vtm = body.match(/id="vtmExtraVars"[^>]*data-var='[^']*"telefono":"([^"]+)"/)?.[1];
  if (vtm) {
    const e164 = normalizarTelefono(vtm.replace(/\u00a0/g, " "));
    if (e164) return e164;
  }
  const owner = body.match(/owner-info__phone[\s\S]*?data-number="([^"]+)"/i)?.[1];
  if (owner) {
    const e164 = normalizarTelefono(owner);
    if (e164) return e164;
  }
  const callBtn = body.match(/class="callBtn"[^>]*data-number="(\d+)"/i)?.[1];
  if (callBtn) {
    const e164 = normalizarTelefono(callBtn);
    if (e164) return e164;
  }
  const telHref = body.match(/href=["']tel:([^"']+)["']/i)?.[1];
  if (telHref) {
    const e164 = normalizarTelefono(telHref);
    if (e164) return e164;
  }
  return undefined;
}

function nombreDesdeHtml(body: string): string | undefined {
  const m = body.match(/class="owner-info__name"[^>]*>(?:<a[^>]*>)?([^<]+)/i);
  return m?.[1]?.trim() || undefined;
}

export function parseDetailPisosHtml(body: string): {
  contacto_telefono?: string;
  contacto_nombre?: string;
} {
  const tel = telefonoDesdeHtml(body);
  const nombre = nombreDesdeHtml(body);
  return {
    ...(tel ? { contacto_telefono: tel } : {}),
    ...(nombre ? { contacto_nombre: nombre } : {}),
  };
}
