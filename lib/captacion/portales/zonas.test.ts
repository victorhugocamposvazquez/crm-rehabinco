import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anuncioEnLocalidad } from "./zonas";

describe("localidades de captación", () => {
  it("Aravaca entra por el barrio y Pozuelo por el municipio", () => {
    assert.equal(anuncioEnLocalidad("Aravaca", { zona: "Aravaca", municipio: "Madrid" }), true);
    assert.equal(anuncioEnLocalidad("Aravaca", { zona: "Valdemarín", municipio: "Madrid" }), false);
    assert.equal(anuncioEnLocalidad("Pozuelo de Alarcón", { zona: "La Finca", municipio: "Pozuelo de Alarcón" }), true);
    assert.equal(anuncioEnLocalidad("Pozuelo de Alarcón", { zona: "Aravaca", municipio: "Madrid" }), false);
    assert.equal(anuncioEnLocalidad("El Plantío", { zona: "El Plantío", municipio: "Madrid" }), true);
  });
});
