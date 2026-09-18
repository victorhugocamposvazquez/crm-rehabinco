#!/usr/bin/env node
/**
 * Ejecuta tests del CRM con node:test + tsx.
 * Excluye explícitamente crawler/** para no mezclar runners.
 */
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const patterns = [
  "lib/catastro/**/*.test.ts",
  "lib/catastro-host/**/*.test.ts",
  "lib/captacion/**/*.test.ts",
  "lib/demandas/**/*.test.ts",
  "lib/citas/**/*.test.ts",
  "lib/tareas/**/*.test.ts",
  "lib/inmuebles/**/*.test.ts",
  "lib/geo/**/*.test.ts",
  "lib/alertas/**/*.test.ts",
  "lib/partes-visita.test.ts",
  "lib/documentos-rehabinco.test.ts",
  "lib/documentos-paginacion.test.ts",
  "lib/contrato-arras-preview.test.ts",
  "lib/build-id.test.ts",
  "lib/auth/**/*.test.ts",
  "lib/ui/**/*.test.ts",
  "scripts/stamp-sw-build.test.mjs",
];

const files = patterns
  .flatMap((p) => globSync(p, { cwd: root, absolute: true }))
  .filter((f) => !f.includes(`${path.sep}crawler${path.sep}`))
  .sort();

if (files.length === 0) {
  console.error("No hay tests CRM que ejecutar.");
  process.exit(1);
}

const env = { ...process.env, CATASTRO_SKIP_LIVE: process.env.CATASTRO_SKIP_LIVE ?? "1" };
const result = spawnSync("npx", ["tsx", "--test", ...files], { cwd: root, env, stdio: "inherit" });
process.exit(result.status ?? 1);
