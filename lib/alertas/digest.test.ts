import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveDigest, resumenAvisosDia, tareaEnDigest } from "./digest";

describe("digest de avisos", () => {
  it("no avisa si el día está vacío", () => {
    assert.equal(resumenAvisosDia([]), null);
  });

  it("resume citas y tareas del día", () => {
    const resumen = resumenAvisosDia([
      { titulo: "Visita Oleiros", hora: "10:00", tipo: "visita" },
      { titulo: "Llamar propietario", hora: "12:30", tipo: "tarea" },
    ]);
    assert.equal(resumen?.titulo, "2 avisos hoy");
    assert.equal(resumen?.cuerpo.includes("Oleiros"), true);
    assert.equal(resumen?.url, "/calendario");
    assert.equal(claveDigest("u1", "2026-09-15T08:00:00Z"), "digest:u1:2026-09-15");
    assert.equal(claveDigest("u1", "2026-09-15", "visitas"), "digest:u1:2026-09-15:visitas");
  });

  it("incluye tareas vencidas y de hoy", () => {
    assert.equal(tareaEnDigest("2026-09-14", "2026-09-15"), true);
    assert.equal(tareaEnDigest("2026-09-15", "2026-09-15"), true);
    assert.equal(tareaEnDigest("2026-09-16", "2026-09-15"), false);
    assert.equal(tareaEnDigest(null, "2026-09-15"), false);
    const resumen = resumenAvisosDia([{ titulo: "Vencida · Llamar", tipo: "tarea-vencida" }]);
    assert.equal(resumen?.titulo, "Tarea vencida");
    assert.equal(resumen?.url, "/tareas");
  });

  it("un canal solo usa su título y su destino", () => {
    const visitas = resumenAvisosDia([{ titulo: "Visita Oleiros", hora: "10:00", tipo: "visita" }]);
    assert.equal(visitas?.titulo, "Visita hoy");
    assert.equal(visitas?.url, "/calendario");
    const partes = resumenAvisosDia([{ titulo: "Ana · Oleiros", tipo: "parte" }]);
    assert.equal(partes?.titulo, "Parte sin firmar");
    assert.equal(partes?.url, "/partes-visita");
  });
});
