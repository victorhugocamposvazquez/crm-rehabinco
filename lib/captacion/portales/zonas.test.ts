import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anuncioEnLocalidad, localidadesParaCiudad, opcionesLocalidadFiltro } from "./zonas";

describe("localidades de captación", () => {
  it("Aravaca entra por el barrio y Pozuelo por el municipio", () => {
    assert.equal(anuncioEnLocalidad("Aravaca", { zona: "Aravaca", municipio: "Madrid" }), true);
    assert.equal(anuncioEnLocalidad("Aravaca", { zona: "Valdemarín", municipio: "Madrid" }), false);
    assert.equal(anuncioEnLocalidad("Pozuelo de Alarcón", { zona: "La Finca", municipio: "Pozuelo de Alarcón" }), true);
    assert.equal(anuncioEnLocalidad("Pozuelo de Alarcón", { zona: "Aravaca", municipio: "Madrid" }), false);
    assert.equal(anuncioEnLocalidad("El Plantío", { zona: "El Plantío", municipio: "Madrid" }), true);
  });

  it("el catálogo fijo de Moncloa solo aparece con Madrid o todas", () => {
    assert.ok(localidadesParaCiudad("Madrid").includes("Aravaca"));
    assert.ok(localidadesParaCiudad("todas").includes("Aravaca"));
    assert.deepEqual(localidadesParaCiudad("Cambre"), []);
    assert.deepEqual(localidadesParaCiudad("A Coruña"), []);
  });

  it("en Cambre las localidades salen de los barrios de los anuncios", () => {
    const opts = opcionesLocalidadFiltro("Cambre", [
      { zona: "O Temple", municipio: "Cambre" },
      { zona: "Cambre", municipio: "Cambre" },
      { zona: "Aravaca", municipio: "Madrid" },
      { zona: "Sigrás", municipio: "Cambre" },
    ]);
    assert.deepEqual(opts, ["O Temple", "Sigrás"]);
    assert.equal(opts.includes("Aravaca"), false);
  });
});
