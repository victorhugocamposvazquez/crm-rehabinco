export type PersonaAltaOpcion = { id: string; nombre: string; telefono: string | null };

export type PasoPersonaAlta =
  | { tipo: "listo" }
  | { tipo: "unico"; persona: PersonaAltaOpcion }
  | { tipo: "alta"; nombre: string }
  | { tipo: "varios" }
  | { tipo: "vacio" };

/** Qué hacer si pulsan Crear sin haber elegido persona: no basta con tener texto en el buscador. */
export function resolverPersonaAlta(
  clienteId: string,
  q: string,
  sugeridos: PersonaAltaOpcion[]
): PasoPersonaAlta {
  if (clienteId) return { tipo: "listo" };
  const nombre = q.trim();
  if (sugeridos.length === 1) return { tipo: "unico", persona: sugeridos[0] };
  if (nombre && sugeridos.length === 0) return { tipo: "alta", nombre };
  if (sugeridos.length > 1) return { tipo: "varios" };
  return { tipo: "vacio" };
}

export function mensajePersonaAlta(paso: PasoPersonaAlta): string {
  if (paso.tipo === "varios") return "Hay varios. Pulsa el nombre de la lista para elegirlo.";
  if (paso.tipo === "alta") return "Ese contacto no está. Créalo para continuar.";
  return "Elige un cliente: pulsa un nombre de la lista, o crea uno nuevo.";
}
