import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONA_PROVINCIA_48H } from "./zonas";
import {
  esRecogidaSoloNovedades,
  SONDEO_NOVEDADES_CADA_MIN,
  SONDEO_NOVEDADES_PAGINAS,
  sondeosNovedadesPorDia,
} from "./novedades";

describe("novedades Idealista", () => {
  it("cadencia 15 min → 96 sondeos/día y 2 pág. estimadas", () => {
    assert.equal(SONDEO_NOVEDADES_CADA_MIN, 15);
    assert.equal(SONDEO_NOVEDADES_PAGINAS, 2);
    assert.equal(sondeosNovedadesPorDia(), 96);
  });

  it("solo provincia-48h cuenta como sondeo de novedades", () => {
    assert.equal(esRecogidaSoloNovedades([ZONA_PROVINCIA_48H]), true);
    assert.equal(esRecogidaSoloNovedades([ZONA_PROVINCIA_48H, "oleiros"]), false);
    assert.equal(esRecogidaSoloNovedades(["oleiros"]), false);
    assert.equal(esRecogidaSoloNovedades([]), false);
  });
});
