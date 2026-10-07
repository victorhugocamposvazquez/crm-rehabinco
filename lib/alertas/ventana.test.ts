import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citaEnVentana, clavePronto, minutosHasta, textoPronto } from "./ventana";

const ahora = new Date("2026-10-07T10:00:00.000Z");

describe("ventana de avisos", () => {
  it("incluye la próxima hora y un margen corto ya empezado", () => {
    assert.equal(citaEnVentana("2026-10-07T10:40:00.000Z", ahora), true);
    assert.equal(citaEnVentana("2026-10-07T09:57:00.000Z", ahora), true);
    assert.equal(citaEnVentana("2026-10-07T11:14:00.000Z", ahora), true);
    assert.equal(citaEnVentana("2026-10-07T11:20:00.000Z", ahora), false);
    assert.equal(citaEnVentana("2026-10-07T12:00:00.000Z", ahora), false);
    assert.equal(citaEnVentana("2026-10-07T09:40:00.000Z", ahora), false);
  });

  it("la clave cambia si se mueve la hora", () => {
    assert.equal(clavePronto("c1", "2026-10-07T10:40:00+00:00"), "pronto:c1:2026-10-07T10:40:00+00:00");
    assert.notEqual(clavePronto("c1", "a"), clavePronto("c1", "b"));
  });

  it("el texto dice los minutos que faltan", () => {
    assert.equal(minutosHasta("2026-10-07T10:40:00.000Z", ahora), 40);
    assert.equal(textoPronto("2026-10-07T10:40:00.000Z", ahora), "Empieza en 40 min");
    assert.equal(textoPronto("2026-10-07T10:00:30.000Z", ahora), "Empieza ahora");
  });
});
