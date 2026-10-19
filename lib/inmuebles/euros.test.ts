import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eurosDesdeTexto } from "./euros";

describe("euros desde texto", () => {
  it("entiende el punto de miles y el símbolo", () => {
    assert.equal(eurosDesdeTexto("350.000"), 350000);
    assert.equal(eurosDesdeTexto("350.000 €"), 350000);
    assert.equal(eurosDesdeTexto("1.250.000"), 1250000);
    assert.equal(eurosDesdeTexto("1.200,50"), 1200.5);
    assert.equal(eurosDesdeTexto("850"), 850);
  });

  it("un campo vacío no es un precio", () => {
    assert.equal(eurosDesdeTexto(""), null);
    assert.equal(eurosDesdeTexto("consultar"), null);
  });
});
