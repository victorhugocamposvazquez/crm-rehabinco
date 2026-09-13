import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { NOTAS_FINCA_MAX, notaDesdeFila, textoNotaFinca } from "./finca-notes";

describe("finca-notes", () => {
  it("recorta y normaliza el texto sin inventar contenido", () => {
    assert.equal(textoNotaFinca(null), "");
    assert.equal(textoNotaFinca("Hola\r\nmundo"), "Hola\nmundo");
    assert.equal(textoNotaFinca("x".repeat(NOTAS_FINCA_MAX + 20)).length, NOTAS_FINCA_MAX);
  });

  it("devuelve nota vacía si aún no hay fila", () => {
    assert.deepEqual(notaDesdeFila("12345678901234", null), {
      fincaReference: "12345678901234",
      notes: "",
      updatedAt: null,
    });
  });

  it("la migración aísla las notas del snapshot de Catastro y activa RLS", () => {
    const sql = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations/20260913222256_catastro_explorer_notes.sql"),
      "utf8"
    );
    assert.match(sql, /create table if not exists public\.catastro_explorer_notes/);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /Autenticado lee notas catastro/);
    assert.doesNotMatch(sql, /\bdh_status\b/);
  });
});
