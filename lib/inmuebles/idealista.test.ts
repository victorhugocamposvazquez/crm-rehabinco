import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  idealistaSoloCalleApi,
  idealistaTipoDesdeTipoInmueble,
  parseIdealistaVisibilidad,
  requiereCertificadoIdealista,
  tipoIdealistaEfectivo,
} from "./idealista";

describe("idealista catalogo", () => {
  it("mapea tipo CRM a Idealista", () => {
    assert.equal(idealistaTipoDesdeTipoInmueble("solar"), "terreno");
    assert.equal(idealistaTipoDesdeTipoInmueble("edificio"), "edificio");
  });

  it("tipo efectivo prioriza idealista_tipo", () => {
    assert.equal(tipoIdealistaEfectivo("edificio", "piso"), "edificio");
    assert.equal(tipoIdealistaEfectivo("", "garaje"), "garaje");
  });

  it("visibilidad por defecto exacta", () => {
    assert.equal(parseIdealistaVisibilidad(null), "exacta");
    assert.equal(parseIdealistaVisibilidad("solo_calle"), "solo_calle");
  });

  it("edificio no exige certificado como vivienda", () => {
    assert.equal(requiereCertificadoIdealista("edificio"), false);
    assert.equal(requiereCertificadoIdealista("piso"), true);
  });

  it("solo calle en API", () => {
    assert.equal(idealistaSoloCalleApi("solo_calle"), true);
    assert.equal(idealistaSoloCalleApi("exacta"), false);
  });
});
