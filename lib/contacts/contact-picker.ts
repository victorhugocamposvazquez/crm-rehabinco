export type ContactoImportado = {
  nombre?: string;
  telefono?: string;
  email?: string;
};

type ContactProperty = "name" | "email" | "tel";

interface ContactInfo {
  name?: string[];
  email?: string[];
  tel?: string[];
}

interface ContactsManager {
  select(properties: ContactProperty[], options?: { multiple?: boolean }): Promise<ContactInfo[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
    standalone?: boolean;
  }
}

export function contactPickerDisponible(): boolean {
  if (typeof window === "undefined") return false;
  return "contacts" in navigator && typeof navigator.contacts?.select === "function";
}

/** PWA instalada o teléfono/tablet: mostramos el botón aunque iOS no tenga Contact Picker API. */
export function mostrarBotonImportarContacto(): boolean {
  if (typeof window === "undefined") return false;
  if (contactPickerDisponible()) return true;

  const ua = navigator.userAgent;
  const movil = /Android|iPhone|iPad|iPod/i.test(ua);
  const pwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigator.standalone === true;

  return movil || pwa;
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

function parsearVCard(texto: string): ContactoImportado | null {
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

function parsearTextoPlano(texto: string): ContactoImportado | null {
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

async function importarDesdeAgenda(): Promise<ContactoImportado | null> {
  const seleccion = await navigator.contacts!.select(["name", "tel", "email"], { multiple: false });
  const contacto = seleccion[0];
  if (!contacto) return null;

  return {
    nombre: normalizarNombre(contacto.name),
    telefono: normalizarTelefono(contacto.tel?.find((t) => t.trim())),
    email: normalizarEmail(contacto.email?.find((e) => e.trim())),
  };
}

async function importarDesdePortapapeles(): Promise<ContactoImportado | null> {
  if (!navigator.clipboard?.readText) {
    throw new Error(
      "En iPhone: abre Contactos, mantén pulsado el contacto, elige Copiar y vuelve a pulsar este botón."
    );
  }

  let texto = "";
  try {
    texto = await navigator.clipboard.readText();
  } catch {
    throw new Error(
      "Permite pegar desde el portapapeles o copia el contacto desde la app Contactos y vuelve a pulsar."
    );
  }

  const datos = parsearTextoPlano(texto);
  if (!datos) {
    throw new Error(
      "No hay un contacto en el portapapeles. Cópialo desde Contactos (Compartir o Copiar) y pulsa de nuevo."
    );
  }
  return datos;
}

export async function importarContactoTelefono(): Promise<ContactoImportado | null> {
  if (contactPickerDisponible()) {
    try {
      return await importarDesdeAgenda();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (!/cancel/i.test(msg)) {
        const desdePortapapeles = await importarDesdePortapapeles().catch(() => null);
        if (desdePortapapeles) return desdePortapapeles;
      }
      throw error;
    }
  }

  return importarDesdePortapapeles();
}
