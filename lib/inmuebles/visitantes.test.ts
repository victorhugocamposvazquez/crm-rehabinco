import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unificarVisitantesInmueble } from "./visitantes";

describe("unificarVisitantesInmueble", () => {
  it("fusiona parte con su cita", () => {
    const out = unificarVisitantesInmueble(
      [
        {
          id: "p1",
          fecha_visita: "2026-11-10",
          visitante_nombre: "Ana",
          estado: "firmado",
          cliente_id: "c1",
          cita_id: "cita1",
          clientes: { id: "c1", nombre: "Ana López" },
        },
      ],
      [
        {
          id: "cita1",
          empieza: "2026-11-10T11:00:00Z",
          estado: "hecha",
          titulo: "Visita Oleiros",
          cliente_id: "c1",
          clientes: { id: "c1", nombre: "Ana López" },
        },
      ]
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].parteId, "p1");
    assert.equal(out[0].citaId, "cita1");
    assert.equal(out[0].clienteId, "c1");
    assert.equal(out[0].nombre, "Ana López");
  });

  it("mantiene cita sin parte y parte sin cita", () => {
    const out = unificarVisitantesInmueble(
      [
        {
          id: "p2",
          fecha_visita: "2026-10-01",
          visitante_nombre: "Solo texto",
          estado: "borrador",
          cliente_id: null,
          cita_id: null,
        },
      ],
      [
        {
          id: "cita2",
          empieza: "2026-12-01T10:00:00Z",
          estado: "prevista",
          titulo: "Visita próxima",
          cliente_id: "c2",
          clientes: { id: "c2", nombre: "Luis" },
        },
      ]
    );
    assert.equal(out.length, 2);
    assert.ok(out.some((v) => v.citaId === "cita2" && !v.parteId));
    assert.ok(out.some((v) => v.parteId === "p2" && v.nombre === "Solo texto"));
  });
});
