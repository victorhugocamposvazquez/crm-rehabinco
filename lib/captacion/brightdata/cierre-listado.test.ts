import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hayListadosPendientesRecogida } from "./recogidas";

describe("cierre de recogida con fichas pendientes", () => {
  it("fichas y teléfonos no bloquean el cierre", () => {
    const cola = [
      { recogida_id: "r1", tipo: "listado", estado: "hecha" },
      { recogida_id: null, tipo: "ficha", estado: "pendiente" },
      { recogida_id: null, tipo: "telefono", estado: "pendiente" },
    ];
    assert.equal(hayListadosPendientesRecogida(cola, "r1"), false);
  });

  it("listado pendiente sí bloquea", () => {
    const cola = [
      { recogida_id: "r1", tipo: "listado", estado: "pendiente" },
      { recogida_id: null, tipo: "ficha", estado: "pendiente" },
    ];
    assert.equal(hayListadosPendientesRecogida(cola, "r1"), true);
  });
});
