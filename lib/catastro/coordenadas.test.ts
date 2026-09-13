import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsearCoordenadasCpmrc } from "./coordenadas";

const FUENCARRAL = {
  Consulta_CPMRCResult: {
    control: { cucoor: 1 },
    coordenadas: {
      coord: [
        {
          pc: { pc1: "0751301", pc2: "VK4705B" },
          geo: { xcen: "-3.70043812348364", ycen: "40.4233944345358", srs: "EPSG:4326" },
          ldt: "CL FUENCARRAL 50 MADRID (MADRID)",
        },
      ],
    },
  },
};

describe("Consulta_CPMRC", () => {
  it("lee el centroide oficial de la parcela", () => {
    const geo = parsearCoordenadasCpmrc(FUENCARRAL);
    assert.ok(geo);
    assert.equal(geo.fincaReference, "0751301VK4705B");
    assert.equal(geo.srs, "EPSG:4326");
    assert.equal(geo.x, -3.70043812348364);
    assert.equal(geo.y, 40.4233944345358);
  });

  it("sin coordenadas no inventa un punto", () => {
    assert.equal(parsearCoordenadasCpmrc({ Consulta_CPMRCResult: { control: { cuerr: 1 } } }), null);
    assert.equal(parsearCoordenadasCpmrc(null), null);
  });
});
