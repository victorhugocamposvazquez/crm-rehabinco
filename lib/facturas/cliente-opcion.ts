export type ClienteOpcion = { id: string; nombre: string };

/** El cliente guardado en la factura, aunque el listado general aún no lo traiga. */
export function clienteDeFactura(raw: unknown, clienteId: string | null): ClienteOpcion | null {
  const fila = Array.isArray(raw) ? raw[0] : raw;
  if (fila && typeof fila === "object" && "id" in fila && typeof fila.id === "string") {
    const nombre = "nombre" in fila && typeof fila.nombre === "string" ? fila.nombre.trim() : "";
    return { id: fila.id, nombre: nombre || "Cliente de la factura" };
  }
  if (!clienteId) return null;
  return { id: clienteId, nombre: "Cliente de la factura" };
}

export function conClienteFicha(lista: ClienteOpcion[], ficha: ClienteOpcion | null): ClienteOpcion[] {
  if (!ficha || lista.some((c) => c.id === ficha.id)) return lista;
  return [...lista, ficha].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
