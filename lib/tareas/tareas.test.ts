import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agruparTareas, bandejaDeTarea, columnaDeTarea, parseTareaRapida, recuentoTareas, textoVinculoTarea, cuandoActividad } from "./tareas";

describe("organizador de tareas", () => {
  it("separa vencidas, hoy y próximas", () => {
    assert.equal(bandejaDeTarea("2026-09-10", "2026-09-14", "pendiente"), "VENCIDAS");
    assert.equal(bandejaDeTarea("2026-09-14", "2026-09-14", "pendiente"), "HOY");
    assert.equal(bandejaDeTarea("2026-09-20", "2026-09-14", "pendiente"), "PROXIMAS");
    assert.equal(bandejaDeTarea(null, "2026-09-14", "pendiente"), "SIN_FECHA");
    assert.equal(bandejaDeTarea("2026-09-10", "2026-09-14", "hecha"), "HECHAS");
    assert.equal(bandejaDeTarea("2026-09-20", "2026-09-14", "esperando"), "ESPERANDO");
  });

  it("coloca vencidas+hoy en la columna Hoy del tablero", () => {
    assert.equal(columnaDeTarea("2026-09-10", "2026-09-14", "pendiente"), "hoy");
    assert.equal(columnaDeTarea("2026-09-16", "2026-09-14", "pendiente"), "curso");
    const parsed = parseTareaRapida("Llamar propietario mañana 10:00", new Date("2026-09-14T12:00:00"));
    assert.equal(parsed.hora, "10:00");
    assert.equal(parsed.vence, "2026-09-15");
    assert.match(parsed.titulo, /Llamar propietario/);
  });

  it("recuenta la bandeja del comercial", () => {
    const grupos = agruparTareas(
      [
        { id: "1", vence: "2026-09-01", estado: "pendiente" },
        { id: "2", vence: "2026-09-14", estado: "pendiente" },
        { id: "3", vence: null, estado: "hecha" },
      ],
      "2026-09-14"
    );
    assert.equal(grupos.VENCIDAS.length, 1);
    assert.equal(grupos.HOY.length, 1);
    assert.equal(recuentoTareas(grupos.VENCIDAS.concat(grupos.HOY), "2026-09-14").HOY, 1);
  });

  it("elige el vínculo principal y etiqueta la actividad", () => {
    assert.equal(textoVinculoTarea({ propiedad: "RHB-0138", cliente: "María" }), "RHB-0138");
    assert.equal(textoVinculoTarea({ finca: "87016006NJ4080S" }), "87016006NJ4080S");
    assert.equal(textoVinculoTarea({}), "Sin vincular");
    assert.equal(cuandoActividad("2026-09-14T09:30:00.000Z", "2026-09-14"), "Hoy");
    assert.equal(cuandoActividad("2026-09-13T09:30:00.000Z", "2026-09-14"), "Ayer");
  });
});
