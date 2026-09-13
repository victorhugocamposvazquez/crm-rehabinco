import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATASTRO_WMS } from "../constants";
import {
  CATASTRO_CARTOGRAFIA_MAPA,
  crearUrlMapaCatastral,
  crearUrlWmsCatastral,
} from "./catastro-map";

describe("URLs de mapa catastral", () => {
  it("usa el visor oficial con la RC de finca (14)", () => {
    const url = crearUrlMapaCatastral("0751301VK4705B");
    assert.equal(url, `${CATASTRO_CARTOGRAFIA_MAPA}?refcat=0751301VK4705B`);
  });

  it("una RC de inmueble (20) se recorta a finca, como hace Catastro", () => {
    const url = crearUrlMapaCatastral("0751301VK4705B0003PO");
    assert.equal(url, `${CATASTRO_CARTOGRAFIA_MAPA}?refcat=0751301VK4705B`);
  });

  it("el WMS recorta alrededor del centroide oficial", () => {
    const url = crearUrlWmsCatastral({
      x: -3.70043812348364,
      y: 40.4233944345358,
      srs: "EPSG:4326",
    });
    assert.ok(url?.startsWith(`${CATASTRO_WMS}?`));
    const params = new URL(url!).searchParams;
    assert.equal(params.get("REQUEST"), "GetMap");
    assert.equal(params.get("LAYERS"), "CATASTRO");
    assert.equal(params.get("SRS"), "EPSG:4326");
    assert.match(params.get("BBOX") ?? "", /^-3\.70/);
  });

  it("sin referencia o sin coordenadas no inventa URL", () => {
    assert.equal(crearUrlMapaCatastral(""), null);
    assert.equal(crearUrlMapaCatastral("ABC"), null);
    assert.equal(crearUrlWmsCatastral({ x: Number.NaN, y: 40, srs: "EPSG:4326" }), null);
  });
});
