import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  asignacionDesdeFila,
  esRolAsignable,
  nombreComercial,
  uuidComercial,
} from "./finca-assignment";

describe("finca-assignment", () => {
  it("nombra al comercial sin inventar datos", () => {
    assert.equal(nombreComercial({ nombre_completo: "Hugo Campos", email: "hugo@x.com" }), "Hugo Campos");
    assert.equal(nombreComercial({ nombre_completo: "  ", email: "hugo@x.com" }), "hugo");
    assert.equal(esRolAsignable("comercial"), true);
    assert.equal(esRolAsignable("editor"), false);
    assert.equal(uuidComercial("no-es-uuid"), null);
  });

  it("arma la asignación solo si hay comercial", () => {
    const comerciales = [{ id: "11111111-1111-4111-8111-111111111111", nombre: "Rocío" }];
    assert.equal(asignacionDesdeFila("12345678901234", null, comerciales), null);
    assert.deepEqual(
      asignacionDesdeFila(
        "12345678901234",
        { comercial_id: "11111111-1111-4111-8111-111111111111" },
        comerciales
      ),
      {
        fincaReference: "12345678901234",
        comercialId: "11111111-1111-4111-8111-111111111111",
        nombre: "Rocío",
      }
    );
  });

  it("la migración no crea visitas ni toca la clasificación", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../supabase/migrations/20260913222520_catastro_explorer_assignments.sql"
      ),
      "utf8"
    );
    assert.match(sql, /create table if not exists public\.catastro_explorer_assignments/);
    assert.match(sql, /enable row level security/);
    assert.doesNotMatch(sql, /partes_visita|\bdh_status\b/);
  });
});
