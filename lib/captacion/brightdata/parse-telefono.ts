import { telefonoE164 } from "@/lib/captacion/contacto";

export type TelefonoIdealista = {
  externo_id: string | null;
  telefonos: string[];
  transporte_ok: boolean;
};

type PhoneBlock = { number?: unknown; prefix?: unknown };

function numeroDe(bloque: PhoneBlock | null | undefined): string | null {
  if (!bloque || typeof bloque !== "object") return null;
  const number = typeof bloque.number === "string" ? bloque.number.trim() : "";
  if (!number) return null;
  if (number.startsWith("+")) return telefonoE164(number);
  const prefix = typeof bloque.prefix === "string" ? bloque.prefix.trim() : "";
  const crudo = prefix ? `${prefix}${number.replace(/^0+/, "")}` : number;
  return telefonoE164(crudo);
}

/** JSON de contact-phones. HTML/captcha = fallo de transporte. */
export function parsearTelefonoIdealista(cuerpo: string, externoId?: string | null): TelefonoIdealista {
  const limpio = cuerpo.trim();
  if (!limpio || /access denied|captcha|<html|<!doctype/i.test(limpio.slice(0, 200))) {
    return { externo_id: externoId ?? null, telefonos: [], transporte_ok: false };
  }
  let json: unknown;
  try {
    json = JSON.parse(limpio);
  } catch {
    return { externo_id: externoId ?? null, telefonos: [], transporte_ok: false };
  }
  if (!json || typeof json !== "object") {
    return { externo_id: externoId ?? null, telefonos: [], transporte_ok: true };
  }
  const raiz = json as Record<string, unknown>;
  const id =
    externoId ??
    (typeof raiz.adId === "string" || typeof raiz.adId === "number" ? String(raiz.adId) : null);
  const telefonos: string[] = [];
  for (const tel of [numeroDe(raiz.phone1 as PhoneBlock), numeroDe(raiz.phone2 as PhoneBlock)]) {
    if (tel && !telefonos.includes(tel)) telefonos.push(tel);
  }
  return { externo_id: id, telefonos, transporte_ok: true };
}
