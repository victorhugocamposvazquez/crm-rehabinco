import { timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const cache = new Map<string, string>();

/** Secreto de avisos. Primero la caché de esta instancia; si no, la fila de private.avisos_config. */
export async function secretoAviso(nombre: string): Promise<string | null> {
  const guardado = cache.get(nombre);
  if (guardado) return guardado;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("crm_secreto_aviso", { nombre });
    if (error || typeof data !== "string") return null;
    const valor = data.trim();
    if (!valor) return null;
    cache.set(nombre, valor);
    return valor;
  } catch {
    return null;
  }
}

function mismoSecreto(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * El cron de avisos acepta el CRON_SECRET del servidor o el que Supabase
 * guarda y envía (private.avisos_config, id cron_secret).
 */
export async function cronAutorizadoAvisos(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return false;
  const deEntorno = process.env.CRON_SECRET?.trim();
  if (deEntorno && mismoSecreto(token, deEntorno)) return true;
  const deBase = await secretoAviso("cron_secret");
  return Boolean(deBase) && mismoSecreto(token, deBase!);
}
