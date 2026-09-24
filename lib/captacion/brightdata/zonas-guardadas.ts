import { createAdminClient } from "@/lib/supabase/admin";
import { ZONAS_IDEALISTA, esZonaIdealista, urlsDeZonas, zonasPorDefecto, type OperacionZona } from "@/lib/captacion/brightdata/zonas";

export async function idsZonasActivas(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("captacion_brightdata_zonas").select("id, activa");
    if (error) return zonasPorDefecto();
    const filas = (data ?? []) as Array<{ id?: string; activa?: boolean }>;
    if (filas.length === 0) return zonasPorDefecto();
    return filas.filter((fila) => fila.activa && typeof fila.id === "string" && esZonaIdealista(fila.id)).map((fila) => fila.id as string);
  } catch {
    return zonasPorDefecto();
  }
}

export async function estimadosZonas(): Promise<Record<string, number | null>> {
  const base: Record<string, number | null> = {};
  for (const zona of ZONAS_IDEALISTA) base[zona.id] = zona.anuncios > 0 ? zona.anuncios : null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("captacion_brightdata_zonas").select("id, estimado");
    for (const fila of (data ?? []) as Array<{ id?: string; estimado?: number | null }>) {
      if (typeof fila.id === "string" && fila.id in base && typeof fila.estimado === "number") base[fila.id] = fila.estimado;
    }
  } catch {
    return base;
  }
  return base;
}

export async function urlsZonasActivas(): Promise<string[]> {
  const ids = await idsZonasActivas();
  const operacion: Record<string, OperacionZona> = {};
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("captacion_brightdata_zonas").select("id, operacion").in("id", ids);
    for (const fila of (data ?? []) as Array<{ id?: string; operacion?: string }>) {
      if (fila.id && (fila.operacion === "venta" || fila.operacion === "alquiler")) operacion[fila.id] = fila.operacion;
    }
  } catch {
    return urlsDeZonas(ids);
  }
  return urlsDeZonas(ids, operacion);
}

export async function guardarZonasActivas(
  ids: string[],
  estimados: Record<string, number | null> = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unicas = [...new Set(ids)];
  if (unicas.length === 0) return { ok: false, error: "Marca al menos una zona." };
  if (unicas.some((id) => !esZonaIdealista(id))) return { ok: false, error: "Hay una zona que no está en el catálogo." };
  try {
    const admin = createAdminClient();
    const ahora = new Date().toISOString();
    const { error } = await admin.from("captacion_brightdata_zonas").upsert(
      ZONAS_IDEALISTA.map((zona) => ({
        id: zona.id,
        activa: unicas.includes(zona.id),
        operacion: zona.operacion,
        estimado: typeof estimados[zona.id] === "number" ? estimados[zona.id] : zona.anuncios > 0 ? zona.anuncios : null,
        updated_at: ahora,
      }))
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se han podido guardar las zonas." };
  }
}
