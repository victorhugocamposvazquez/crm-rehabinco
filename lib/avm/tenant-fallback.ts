import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const MARCA = "TODO: eliminar antes del segundo tenant";

/** Última definición de una función en el SQL acumulado de las migraciones. */
export function ultimaDefinicion(sql: string, nombre: string): string {
  const re = new RegExp(`create or replace function ${nombre}\\b[\\s\\S]*?\\$\\$;`, "gi");
  const todas = sql.match(re) ?? [];
  return todas[todas.length - 1] ?? "";
}

export function sqlMigracionesAvm(root: string): string {
  const dir = path.join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && f.includes("avm"))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

/** El respaldo a Rehabinco sigue en el cuerpo de avm_current_tenant(). */
export function respaldoRehabincoActivo(sql: string): boolean {
  const cuerpo = ultimaDefinicion(sql, "avm_current_tenant");
  return /slug\s*=\s*'rehabinco'/.test(cuerpo);
}

/**
 * Falla (devuelve el motivo) si ya hay más de una agencia y el respaldo sigue.
 * Con una sola agencia el respaldo es válido.
 */
export function respaldoIncompatible(tenantCount: number, sql: string): string | null {
  if (tenantCount > 1 && respaldoRehabincoActivo(sql)) {
    return `${MARCA}: hay ${tenantCount} agencias y avm_current_tenant() aún devuelve Rehabinco por defecto`;
  }
  return null;
}

export function funcionesSecurityDefinerSinSearchPath(sql: string): string[] {
  const re = /create or replace function ([a-z0-9_]+)[\s\S]*?\$\$;/gi;
  const mal: string[] = [];
  for (const bloque of sql.matchAll(re)) {
    const cuerpo = bloque[0];
    if (!/security definer/i.test(cuerpo)) continue;
    if (!/set search_path = public, extensions/i.test(cuerpo)) mal.push(bloque[1]);
  }
  return mal;
}
