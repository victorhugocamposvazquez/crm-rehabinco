#!/usr/bin/env node
/**
 * Aplica migraciones locales pendientes vía Supabase Management API (service role + SQL RPC no disponible).
 * Uso en CI/agente: delegar a MCP execute_sql; este script lista el orden recomendado.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase/migrations");

const ORDER = [
  "20260916180000_contratos_arras_clausulas.sql",
  "20260917140000_portales_zona_coruna.sql",
  "20260923100000_captacion_zonas_idealista.sql",
  "20260923230000_captacion_recogidas.sql",
  "20260924100000_captacion_extension_cron.sql",
  "20260924120000_captacion_cron_diario.sql",
  "20260924140000_captacion_fecha_portal.sql",
  "20260924150000_captacion_zona_vista.sql",
  "20260924160000_captacion_zonas_sospechosas.sql",
  "20260924180000_captacion_paginas_pendientes.sql",
  "20260924190000_captacion_zonas_municipio.sql",
  "20260925120000_captacion_fichas.sql",
  "20260925140000_captacion_telefonos.sql",
  "20260925160000_captacion_unlocker_diagnostico.sql",
  "20260925200000_captacion_rafagas_locks_cron.sql",
  "20260925210000_reencolar_telefonos_fallidos.sql",
  "20260926100000_captacion_telefono_estados.sql",
  "20260926110000_despausar_telefonos_recalc.sql",
  "20260926130000_captacion_zonas_14_grandes.sql",
  "20261001120000_herramientas_plantillas_contratos.sql",
  "20261007120000_citas_delegar_rls.sql",
  "20261008180000_demandas_equipo_guarda.sql",
  "20261009120000_citas_tipo_tasacion.sql",
  "20261013150000_avm_data_jobs_health.sql",
];

const all = new Set(readdirSync(dir).filter((f) => f.endsWith(".sql")));
for (const f of ORDER) {
  if (!all.has(f)) {
    console.error("Falta en disco:", f);
    process.exit(1);
  }
  const sql = readFileSync(path.join(dir, f), "utf8");
  console.log("---FILE:", f, "BYTES:", sql.length);
}

console.log("OK", ORDER.length, "migraciones en orden.");
