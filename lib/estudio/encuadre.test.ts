import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENCUADRE_BASE, encuadreDe, escalaEncuadre, transformEncuadre } from "./encuadre";

describe("encuadre de foto", () => {
  it("sin ajuste la foto no se mueve ni se amplía", () => {
    assert.deepEqual(encuadreDe(null), ENCUADRE_BASE);
    assert.equal(escalaEncuadre(ENCUADRE_BASE), 1);
    assert.equal(transformEncuadre(ENCUADRE_BASE), "translate(0%, 0%) rotate(0deg) scale(1)");
  });

  it("girar 90° agranda lo justo para no dejar huecos y un cuarto de vuelta vuelve al sitio", () => {
    const giro = encuadreDe({ zoom: 1, x: 0, y: 0, rot: 90 });
    assert.ok(Math.abs(escalaEncuadre(giro) - 2.05) < 1e-9);
    assert.equal(encuadreDe({ rot: -90 }).rot, 270);
    assert.equal(escalaEncuadre(encuadreDe({ zoom: 2, rot: 180 })), 2);
  });

  it("recorta un zoom o un desplazamiento imposibles", () => {
    const enc = encuadreDe({ zoom: 9, x: 400, y: -20, rot: 15 });
    assert.equal(enc.zoom, 3);
    assert.equal(enc.x, 80);
    assert.equal(enc.y, -20);
    assert.equal(enc.rot, 15);
  });
});
