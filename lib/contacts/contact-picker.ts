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
  }
}

export function contactPickerDisponible(): boolean {
  if (typeof window === "undefined") return false;
  return "contacts" in navigator && typeof navigator.contacts?.select === "function";
}

function normalizarNombre(names?: string[]): string | undefined {
  if (!names?.length) return undefined;
  const texto = names.map((n) => n.trim()).filter(Boolean).join(" ");
  return texto || undefined;
}

function normalizarTelefono(tels?: string[]): string | undefined {
  const raw = tels?.find((t) => t.trim());
  if (!raw) return undefined;
  const limpio = raw.replace(/[^\d+]/g, "");
  return limpio || raw.trim();
}

function normalizarEmail(emails?: string[]): string | undefined {
  return emails?.find((e) => e.trim())?.trim();
}

export async function importarContactoTelefono(): Promise<ContactoImportado | null> {
  if (!contactPickerDisponible()) {
    throw new Error("Tu navegador no permite acceder a los contactos del teléfono.");
  }

  const seleccion = await navigator.contacts!.select(["name", "tel", "email"], { multiple: false });
  const contacto = seleccion[0];
  if (!contacto) return null;

  return {
    nombre: normalizarNombre(contacto.name),
    telefono: normalizarTelefono(contacto.tel),
    email: normalizarEmail(contacto.email),
  };
}
