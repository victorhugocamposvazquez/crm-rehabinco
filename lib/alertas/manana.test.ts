import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esFranjaDeHora } from "./madrid";
import { cuerpoTareasDelDia, esFranjaManana, fechaMadrid, claveManana } from "./manana";
import { horaDiariaDe } from "./prefs";

describe("resumen de las 10:00", () => {
  it("solo entra en los primeros 15 minutos de las 10, hora de Madrid", () => {
    assert.equal(esFranjaManana(new Date("2026-10-07T08:00:00.000Z")), true);
    assert.equal(esFranjaManana(new Date("2026-10-07T08:14:00.000Z")), true);
    assert.equal(esFranjaManana(new Date("2026-10-07T08:15:00.000Z")), false);
    assert.equal(esFranjaManana(new Date("2026-10-07T07:00:00.000Z")), false);
    assert.equal(esFranjaManana(new Date("2026-01-15T09:00:00.000Z")), true);
    assert.equal(esFranjaDeHora(8, new Date("2026-10-07T06:00:00.000Z")), true);
    assert.equal(esFranjaDeHora(8, new Date("2026-10-07T06:15:00.000Z")), false);
    assert.equal(horaDiariaDe(null), 10);
    assert.equal(horaDiariaDe({ hora_diaria: 18 }), 18);
    assert.equal(horaDiariaDe({ hora_diaria: 24 }), 10);
    assert.equal(fechaMadrid(new Date("2026-10-07T22:30:00.000Z")), "2026-10-08");
  });

  it("arma el texto del día y no repite la clave", () => {
    assert.equal(
      cuerpoTareasDelDia([
        { hora: "10:00", titulo: "Visita Oleiros" },
        { hora: null, titulo: "Llamar propietario" },
      ]),
      "10:00 Visita Oleiros · Llamar propietario"
    );
    assert.equal(claveManana("u1", "2026-10-07"), "dia:u1:2026-10-07");
  });
});
