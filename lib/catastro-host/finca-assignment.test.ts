import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  asignacionDesdeFila,
  coincideFiltroAsignacion,
  esRolAsignable,
  filtrarPorAsignacion,
  FILTRO_ASIGNACION_MIAS,
  FILTRO_ASIGNACION_SIN,
  FILTRO_ASIGNACION_TODAS,
  nombreComercial,
  recuentoFiltrosAsignacion,
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

  it("filtra el listado por comercial, sin asignar o mías", () => {
    const rocío = "11111111-1111-4111-8111-111111111111";
    const hugo = "22222222-2222-4222-8222-222222222222";
    const fincas = [{ fincaReference: "A" }, { fincaReference: "B" }, { fincaReference: "C" }];
    const asignaciones = {
      A: { fincaReference: "A", comercialId: rocío, nombre: "Rocío" },
      B: { fincaReference: "B", comercialId: hugo, nombre: "Hugo" },
    };
    const comerciales = [
      { id: rocío, nombre: "Rocío" },
      { id: hugo, nombre: "Hugo" },
    ];
    assert.equal(coincideFiltroAsignacion(undefined, FILTRO_ASIGNACION_TODAS, hugo), true);
    assert.equal(coincideFiltroAsignacion(undefined, FILTRO_ASIGNACION_SIN, hugo), true);
    assert.equal(coincideFiltroAsignacion(asignaciones.A, FILTRO_ASIGNACION_SIN, hugo), false);
    assert.equal(coincideFiltroAsignacion(asignaciones.B, FILTRO_ASIGNACION_MIAS, hugo), true);
    assert.equal(coincideFiltroAsignacion(asignaciones.A, FILTRO_ASIGNACION_MIAS, hugo), false);
    assert.deepEqual(
      filtrarPorAsignacion(fincas, asignaciones, rocío, hugo).map((item) => item.fincaReference),
      ["A"]
    );
    assert.deepEqual(
      filtrarPorAsignacion(fincas, asignaciones, FILTRO_ASIGNACION_SIN, hugo).map(
        (item) => item.fincaReference
      ),
      ["C"]
    );
    assert.deepEqual(recuentoFiltrosAsignacion(fincas, asignaciones, hugo, comerciales), {
      todas: 3,
      sinAsignar: 1,
      mias: 1,
      porComercial: { [rocío]: 1, [hugo]: 1 },
    });
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
