import { createAdminClient } from "@/lib/supabase/admin";
import { ZONAS_IDEALISTA, esZonaIdealista, urlsDeZonas } from "@/lib/captacion/brightdata/zonas";

export async function idsZonasActivas(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("captacion_brightdata_zonas").select("id, activa");
    if (error) return ZONAS_IDEALISTA.map((zona) => zona.id);
    const filas = (data ?? []) as Array<{ id?: string; activa?: boolean }>;
    if (filas.length === 0) return ZONAS_IDEALISTA.map((zona) => zona.id);
    return filas.filter((fila) => fila.activa && typeof fila.id === "string" && esZonaIdealista(fila.id)).map((fila) => fila.id as string);
  } catch {
    return ZONAS_IDEALISTA.map((zona) => zona.id);
  }
}

export async function urlsZonasActivas(): Promise<string[]> {
  return urlsDeZonas(await idsZonasActivas());
}

export async function guardarZonasActivas(ids: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
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
        updated_at: ahora,
      }))
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se han podido guardar las zonas." };
  }
}
