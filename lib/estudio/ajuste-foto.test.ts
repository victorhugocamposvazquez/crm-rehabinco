import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ajusteDe, filtroAjuste, fondoVineta } from "./ajuste-foto";

describe("ajuste de foto", () => {
  it("en cero no hay filtro ni viñeta", () => {
    assert.equal(filtroAjuste(null), "none");
    assert.equal(filtroAjuste({ vineta: 40 }), "none");
    assert.equal(fondoVineta(null), null);
  });

  it("recorta un valor imposible y deja ver el cambio", () => {
    const ajuste = ajusteDe({ brillo: 400, vineta: -150, tono: 20 });
    assert.equal(ajuste.brillo, 100);
    assert.equal(ajuste.vineta, -100);
    assert.equal(ajuste.tono, 20);
    assert.match(filtroAjuste({ brillo: 40 }), /brightness\(/);
    assert.match(filtroAjuste({ calidez: 50 }), /sepia\(/);
    assert.match(fondoVineta({ vineta: 50 }) ?? "", /radial-gradient/);
    assert.match(fondoVineta({ vineta: -50 }) ?? "", /255,255,255/);
  });
});
