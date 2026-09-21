export type ContactoImportado = {
  nombre?: string;
  telefono?: string;
  email?: string;
};

type ContactProperty = "name" | "email" | "tel" | "address" | "icon";

interface ContactInfo {
  name?: string[];
  email?: string[];
  tel?: string[];
}

interface ContactsManager {
  getProperties(): Promise<ContactProperty[]>;
  select(properties: ContactProperty[], options?: { multiple?: boolean }): Promise<ContactInfo[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
    standalone?: boolean;
  }
  interface Window {
    ContactsManager?: unknown;
  }
}

export function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function esAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Chrome/Android: abre la lista nativa de contactos. No existe en iPhone. */
export function contactPickerDisponible(): boolean {
  if (typeof window === "undefined") return false;
  return "contacts" in navigator && typeof navigator.contacts?.select === "function";
}

export function mostrarAyudaCompartirContacto(): boolean {
  if (typeof window === "undefined") return false;
  return esIos() && !contactPickerDisponible();
}

function normalizarNombre(names?: string[]): string | undefined {
  if (!names?.length) return undefined;
  const texto = names.map((n) => n.trim()).filter(Boolean).join(" ");
  return texto || undefined;
}

function normalizarTelefono(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const limpio = raw.replace(/[^\d+]/g, "");
  return limpio || raw.trim();
}

function normalizarEmail(raw?: string): string | undefined {
  return raw?.trim() || undefined;
}

export function parsearVCard(texto: string): ContactoImportado | null {
  const fn = texto.match(/^FN:(.+)$/im)?.[1]?.trim();
  const tel = texto.match(/^TEL[^:]*:(.+)$/im)?.[1]?.trim();
  const email = texto.match(/^EMAIL[^:]*:(.+)$/im)?.[1]?.trim();
  if (!fn && !tel && !email) return null;
  return {
    nombre: fn,
    telefono: normalizarTelefono(tel),
    email: normalizarEmail(email),
  };
}

export function parsearTextoContacto(texto: string): ContactoImportado | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (limpio.includes("BEGIN:VCARD")) return parsearVCard(limpio);

  const email = limpio.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0];
  const telefono = limpio.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0];
  const sinContacto = limpio
    .replace(email ?? "", "")
    .replace(telefono ?? "", "")
    .replace(/[\n\r|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!email && !telefono && !sinContacto) return null;

  return {
    nombre: sinContacto.length >= 2 && !/^\d+$/.test(sinContacto) ? sinContacto : undefined,
    telefono: normalizarTelefono(telefono),
    email: normalizarEmail(email),
  };
}

/** Abre el selector nativo de contactos (solo Android/Chrome). */
export async function importarContactoTelefono(): Promise<ContactoImportado | null> {
  if (!contactPickerDisponible()) {
    if (esIos()) {
      throw new Error(
        "En iPhone no se puede abrir la agenda desde la web. Usa Contactos → Compartir → CRM REHABINCO."
      );
    }
    throw new Error("Tu navegador no permite elegir contactos. Prueba Chrome en Android.");
  }

  const manager = navigator.contacts!;
  const soportados = await manager.getProperties();
  const props = (["name", "tel", "email"] as ContactProperty[]).filter((p) => soportados.includes(p));
  if (props.length === 0) {
    throw new Error("Este dispositivo no permite leer contactos.");
  }

  const seleccion = await manager.select(props, { multiple: false });
  const contacto = seleccion[0];
  if (!contacto) return null;

  return {
    nombre: normalizarNombre(contacto.name),
    telefono: normalizarTelefono(contacto.tel?.find((t) => t.trim())),
    email: normalizarEmail(contacto.email?.find((e) => e.trim())),
  };
}

export function contactoARedireccion(datos: ContactoImportado): URLSearchParams {
  const params = new URLSearchParams({ nueva: "1" });
  if (datos.nombre) params.set("nombre", datos.nombre);
  if (datos.telefono) params.set("telefono", datos.telefono);
  if (datos.email) params.set("email", datos.email);
  return params;
}
