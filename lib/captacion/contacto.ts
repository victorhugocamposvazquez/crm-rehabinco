import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Normaliza teléfono a E.164 (región ES). */
/** Máscara Idealista (+34 881 35 xx xx). No pasa validación libphonenumber estándar. */
export function esTelefonoVirtualIdealista(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const digits = raw.replace(/\D/g, "");
  const con34 = digits.startsWith("34") ? digits : `34${digits}`;
  return /^3488135\d{4,}$/.test(con34);
}

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
  if (e164 && !esTelefonoVirtualIdealista(e164)) return `tel:${e164}`;
  const n = normalizarNombreContacto(nombre);
  const m = normalizarNombreContacto(municipio);
  if (n.length >= 2 && m) return `nom:${n}|${m}`;
  return null;
}

/** Compat lectura de claves legacy (`t:` / `n:`) y normaliza `nom:` guardadas a mano. */
export function claveContactoCanonica(clave: string | null | undefined): string | null {
  if (!clave) return null;
  if (clave.startsWith("t:")) {
    const e164 = telefonoE164(clave.slice(2));
    return e164 && !esTelefonoVirtualIdealista(e164) ? `tel:${e164}` : null;
  }
  if (clave.startsWith("tel:")) {
    const e164 = telefonoE164(clave.slice(4));
    return e164 && !esTelefonoVirtualIdealista(e164) ? `tel:${e164}` : null;
  }
  if (clave.startsWith("n:")) {
    const rest = clave.slice(2);
    const pipe = rest.lastIndexOf("|");
    if (pipe <= 0) return null;
    const n = normalizarNombreContacto(rest.slice(0, pipe));
    const m = normalizarNombreContacto(rest.slice(pipe + 1));
    return n.length >= 2 && m ? `nom:${n}|${m}` : null;
  }
  if (clave.startsWith("nom:")) {
    const rest = clave.slice(4);
    const pipe = rest.lastIndexOf("|");
    if (pipe <= 0) return null;
    const n = normalizarNombreContacto(rest.slice(0, pipe));
    const m = normalizarNombreContacto(rest.slice(pipe + 1));
    return n.length >= 2 && m ? `nom:${n}|${m}` : null;
  }
  return clave;
}

/** Clave usada para agrupar anuncios del mismo contacto (UI y avisos). */
export function claveAgrupacionAnuncio(a: {
  contacto_clave?: string | null;
  contacto_telefono?: string | null;
  contacto_nombre?: string | null;
  municipio?: string | null;
}): string | null {
  const desdeCampos = claveContacto(a.contacto_telefono, a.contacto_nombre, a.municipio);
  const desdeGuardada = claveContactoCanonica(a.contacto_clave);
  if (desdeCampos?.startsWith("tel:")) return desdeCampos;
  return desdeCampos ?? desdeGuardada;
}
