import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RAFAGA_LIMITES,
  RAFAGA_TOPE_MS,
  estimarMinutosVaciarCola,
  paginasPorMinutoRafaga,
  rafagaDebeParar,
} from "./rafaga-config";

describe("límites de ráfaga", () => {
  it("parada limpia a los 240 s", () => {
    const t0 = 1_000_000;
    assert.equal(rafagaDebeParar(t0, t0 + RAFAGA_TOPE_MS - 1, 0), false);
    assert.equal(rafagaDebeParar(t0, t0 + RAFAGA_TOPE_MS, 0), true);
    assert.equal(rafagaDebeParar(t0, t0 + RAFAGA_TOPE_MS + 50_000, 10), true);
  });

  it("tope de 150 páginas", () => {
    assert.equal(rafagaDebeParar(0, 1, 149), false);
    assert.equal(rafagaDebeParar(0, 1, 150), true);
  });

  it("ppm y estimación de cola", () => {
    assert.equal(paginasPorMinutoRafaga(60, 60_000), 60);
    assert.equal(estimarMinutosVaciarCola(300, 60), 5);
    assert.equal(estimarMinutosVaciarCola(10, null), null);
  });
});
