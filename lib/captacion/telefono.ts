import { esTelefonoVirtualIdealista, telefonoE164 } from "@/lib/captacion/contacto";

function esReal(e164: string | null): boolean {
  return Boolean(e164 && !esTelefonoVirtualIdealista(e164));
}

/** Un teléfono real no se sustituye; un virtual sí cede ante uno real. */
export function fusionarTelefono(
  previo: string | null | undefined,
  entrante: string | null | undefined
): { telefono: string | null; escrito: boolean } {
  const prev = telefonoE164(previo);
  if (esReal(prev)) return { telefono: prev, escrito: false };
  const nuevo = telefonoE164(entrante);
  if (esReal(nuevo)) return { telefono: nuevo, escrito: true };
  if (prev && esTelefonoVirtualIdealista(prev)) return { telefono: prev, escrito: false };
  return { telefono: nuevo, escrito: Boolean(nuevo) };
}
