import { createAdminClient } from "@/lib/supabase/admin";
import { procesarPaginasPendientes } from "@/lib/captacion/brightdata/paginas";
import { adquirirLockProcesar, liberarLockProcesar } from "@/lib/captacion/brightdata/procesar-lock";

export type RafagaCaptacion = {
  id: string;
  iniciada_en: string;
  terminada_en: string | null;
  paginas: number;
  errores: number;
  ok: boolean | null;
  motivo: string | null;
  duracion_ms: number | null;
};

export async function registrarRafagaOmitida(motivo: string): Promise<void> {
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();
  await supabase.from("captacion_rafagas").insert({
    iniciada_en: ahora,
    terminada_en: ahora,
    paginas: 0,
    errores: 0,
    ok: true,
    motivo,
    duracion_ms: 0,
  });
}

async function iniciarRafaga(): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("captacion_rafagas")
    .insert({ ok: null })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(error?.message ?? "No se pudo abrir la ráfaga.");
  return data.id as string;
}

async function cerrarRafaga(
  id: string,
  fin: { paginas: number; errores: number; ok: boolean; motivo?: string | null; duracionMs: number }
): Promise<void> {
  await createAdminClient()
    .from("captacion_rafagas")
    .update({
      terminada_en: new Date().toISOString(),
      paginas: fin.paginas,
      errores: fin.errores,
      ok: fin.ok,
      motivo: fin.motivo ?? null,
      duracion_ms: fin.duracionMs,
    })
    .eq("id", id);
}

/** Una ráfaga completa (lock + procesar + historial). */
export async function ejecutarRafagaProcesar(limite = 20): Promise<void> {
  const t0 = Date.now();
  if (!(await adquirirLockProcesar())) {
    await registrarRafagaOmitida("lock_ocupado");
    return;
  }
  const id = await iniciarRafaga();
  try {
    const resultado = await procesarPaginasPendientes(limite);
    await cerrarRafaga(id, {
      paginas: resultado.paginas,
      errores: resultado.errores,
      ok: true,
      duracionMs: Date.now() - t0,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ráfaga fallida";
    await cerrarRafaga(id, {
      paginas: 0,
      errores: 1,
      ok: false,
      motivo: msg,
      duracionMs: Date.now() - t0,
    });
  } finally {
    await liberarLockProcesar();
  }
}

export async function ultimaRafaga(): Promise<RafagaCaptacion | null> {
  const { data, error } = await createAdminClient()
    .from("captacion_rafagas")
    .select("id, iniciada_en, terminada_en, paginas, errores, ok, motivo, duracion_ms")
    .order("iniciada_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as RafagaCaptacion;
}
