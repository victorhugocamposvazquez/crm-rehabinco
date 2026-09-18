import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normaliza teléfono a E.164 (región ES). */
export function telefonoE164(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const parsed = parsePhoneNumberFromString(t, "ES");
  if (parsed?.isValid()) return parsed.format("E.164");
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 9) {
    const conPrefijo = digits.startsWith("34") ? `+${digits}` : `+34${digits}`;
    const retry = parsePhoneNumberFromString(conPrefijo);
    if (retry?.isValid()) return retry.format("E.164");
  }
  return null;
}

export function normalizarNombreContacto(nombre: string | null | undefined): string {
  return (nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clave de agrupación de contacto.
 * Antes: `t:digits` / `n:nombre|municipio`. Ahora: `tel:{e164}` / `nom:{nombre}|{municipio}`.
 */
export function claveContacto(
  telefono?: string | null,
  nombre?: string | null,
  municipio?: string | null
): string | null {
  const e164 = telefonoE164(telefono);
  if (e164) return `tel:${e164}`;
  const n = normalizarNombreContacto(nombre);
  const m = normalizarNombreContacto(municipio);
  if (n.length >= 2 && m) return `nom:${n}|${m}`;
  return null;
}

/** Compat lectura de claves legacy (`t:` / `n:`). */
export function claveContactoCanonica(clave: string | null | undefined): string | null {
  if (!clave) return null;
  if (clave.startsWith("t:")) {
    const e164 = telefonoE164(clave.slice(2));
    return e164 ? `tel:${e164}` : clave;
  }
  if (clave.startsWith("n:")) return `nom:${clave.slice(2)}`;
  return clave;
}
