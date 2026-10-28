import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { itemCita, ordenarHistorial } from "./historial";

describe("historial cliente", () => {
  it("ordena de más reciente a más antiguo", () => {
    const items = ordenarHistorial([
      itemCita({ id: "1", tipo: "visita", titulo: "A", empieza: "2026-01-01T10:00:00Z", estado: "hecha" }),
      itemCita({ id: "2", tipo: "llamada", titulo: "B", empieza: "2026-03-01T10:00:00Z", estado: "prevista" }),
    ]);
    assert.equal(items[0].titulo, "B");
  });

  it("incluye motivo de anulación en la meta", () => {
    const item = itemCita({
      id: "1",
      tipo: "evento",
      titulo: "Firma",
      empieza: "2026-02-01T10:00:00Z",
      estado: "cancelada",
      motivo_anulacion: "Cliente cancela",
    });
    assert.match(item.meta, /Cliente cancela/);
    assert.match(item.meta, /Anulada/);
  });
});
