import { createAdminClient } from "@/lib/supabase/admin";

export const CLAVE_LOCK_PROCESAR = "procesar";
const TTL_MS = 6 * 60 * 1000;

/** Intenta reservar la ráfaga. Devuelve false si otra instancia sigue dentro del TTL. */
export async function adquirirLockProcesar(): Promise<boolean> {
  const supabase = createAdminClient();
  const ahora = new Date();
  const ahoraIso = ahora.toISOString();
  const expira = new Date(ahora.getTime() + TTL_MS).toISOString();
  await supabase.from("captacion_locks").delete().lt("expira_en", ahoraIso);
  const { error } = await supabase.from("captacion_locks").insert({ clave: CLAVE_LOCK_PROCESAR, expira_en: expira });
  if (!error) return true;
  if (error.code !== "23505") throw new Error(error.message);
  return false;
}

export async function liberarLockProcesar(): Promise<void> {
  await createAdminClient().from("captacion_locks").delete().eq("clave", CLAVE_LOCK_PROCESAR);
}

export async function lockProcesarActivo(): Promise<boolean> {
  const supabase = createAdminClient();
  const ahora = new Date().toISOString();
  await supabase.from("captacion_locks").delete().lt("expira_en", ahora);
  const { data } = await supabase.from("captacion_locks").select("clave").eq("clave", CLAVE_LOCK_PROCESAR).maybeSingle();
  return Boolean(data?.clave);
}
