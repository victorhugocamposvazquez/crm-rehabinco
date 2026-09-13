import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATASTRO_CARTOGRAFIA_CROQUIS,
  CATASTRO_CARTOGRAFIA_MAPA,
  crearUrlCroquisCatastral,
  crearUrlMapaCatastral,
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

  it("el croquis apunta al mapaC oficial con la misma parcela", () => {
    const url = crearUrlCroquisCatastral("0751301VK4705B");
    assert.ok(url?.startsWith(`${CATASTRO_CARTOGRAFIA_CROQUIS}?`));
    const params = new URL(url!).searchParams;
    assert.equal(params.get("refcat"), "0751301VK4705B");
    assert.equal(params.get("from"), "OVCBusq");
  });

  it("sin referencia oficial no inventa URL", () => {
    assert.equal(crearUrlMapaCatastral(""), null);
    assert.equal(crearUrlMapaCatastral("ABC"), null);
    assert.equal(crearUrlCroquisCatastral("123"), null);
  });
});
