import { telefonoE164 } from "@/lib/captacion/contacto";

/** Un teléfono ya válido no se sustituye. Uno vacío no borra el guardado. */
export function fusionarTelefono(
  previo: string | null | undefined,
  entrante: string | null | undefined
): { telefono: string | null; escrito: boolean } {
  const bueno = telefonoE164(previo);
  if (bueno) return { telefono: bueno, escrito: false };
  const nuevo = telefonoE164(entrante);
  return { telefono: nuevo, escrito: Boolean(nuevo) };
}
