import { createAdminClient } from "@/lib/supabase/admin";

/** Hay páginas (listado/ficha/teléfono) listas para procesar ahora. */
export async function hayTrabajoPendienteCola(ahoraIso = new Date().toISOString()): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .from("captacion_paginas_pendientes")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente")
    .or(`reintentar_en.is.null,reintentar_en.lte.${ahoraIso}`);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Recogidas abiertas (pueden cerrarse aunque la cola esté vacía). */
export async function hayRecogidasAbiertas(): Promise<boolean> {
  const { count, error } = await createAdminClient()
    .from("captacion_recogidas")
    .select("collection_id", { count: "exact", head: true })
    .is("completada", null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
