import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  funcionesSecurityDefinerSinSearchPath,
  respaldoIncompatible,
  respaldoRehabincoActivo,
  sqlMigracionesAvm,
} from "../tenant-fallback";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sql = sqlMigracionesAvm(root);

function envLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of [".env.local", "crawler/.env"]) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || out[m[1]]) continue;
      const value = m[2].replace(/^"|"$/g, "");
      if (value) out[m[1]] = value;
    }
  }
  if (!out.NEXT_PUBLIC_SUPABASE_URL && out.SUPABASE_URL) out.NEXT_PUBLIC_SUPABASE_URL = out.SUPABASE_URL;
  return out;
}

describe("respaldo de agencia", () => {
  it("marca el respaldo a Rehabinco para quitarlo antes del segundo tenant", () => {
    expect(sql).toMatch(/TODO: eliminar antes del segundo tenant/);
    expect(respaldoRehabincoActivo(sql)).toBe(true);
    expect(respaldoIncompatible(1, sql)).toBeNull();
    expect(respaldoIncompatible(2, sql)).toMatch(/segundo tenant/);
  });

  it("con una agencia pasa; con dos, un autenticado sin membership no hereda Rehabinco", async () => {
    const env = { ...envLocal(), ...process.env };
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Falta la conexión a Supabase del repo");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { count, error } = await admin.from("tenants").select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    const agencias = count ?? 0;
    expect(agencias).toBeGreaterThan(0);
    if (agencias <= 1) return;

    const email = `avm-sin-membership-${Date.now()}@rehabinco.test`;
    const password = `Avm-${crypto.randomUUID()}`;
    const creado = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (creado.error || !creado.data.user) throw new Error(creado.error?.message ?? "Sin usuario de prueba");
    try {
      const sesion = await admin.auth.signInWithPassword({ email, password });
      if (sesion.error || !sesion.data.session) throw new Error(sesion.error?.message ?? "Sin sesión");
      const usuario = createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${sesion.data.session.access_token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error: rpcError } = await usuario.rpc("avm_current_tenant");
      if (rpcError) throw new Error(rpcError.message);
      expect(data).toBeNull();
    } finally {
      await admin.auth.admin.deleteUser(creado.data.user.id);
    }
  });

  it("las funciones security definer del AVM fijan search_path", () => {
    const definiciones = [
      sql.slice(sql.lastIndexOf("create or replace function avm_current_tenant")),
      sql.slice(sql.lastIndexOf("create or replace function market_zone_stats_refresh")),
    ].join("\n");
    expect(funcionesSecurityDefinerSinSearchPath(definiciones)).toEqual([]);
  });
});
