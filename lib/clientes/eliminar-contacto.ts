import type { SupabaseClient } from "@supabase/supabase-js";

export async function eliminarContacto(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function textoConfirmarEliminarContacto(input: {
  nombre: string;
  tieneOferta?: boolean;
  tieneBusqueda?: boolean;
  numFacturas?: number;
}): { title: string; description: string } {
  const avisos: string[] = [];
  if (input.tieneOferta) avisos.push("Se eliminarán también los inmuebles que ofrece.");
  if (input.tieneBusqueda) avisos.push("Se eliminarán sus demandas.");
  if (input.numFacturas && input.numFacturas > 0) {
    avisos.push(
      `Tiene ${input.numFacturas} factura(s): el contacto desaparece y las facturas quedan sin cliente asignado.`
    );
  }
  return {
    title: `¿Eliminar ${input.nombre}?`,
    description:
      avisos.length > 0
        ? `${avisos.join(" ")} Esta acción no se puede deshacer.`
        : "Esta acción no se puede deshacer.",
  };
}
