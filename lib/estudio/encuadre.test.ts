import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENCUADRE_BASE, conEnderezar, encuadreDe, enderezarDe, escalaEncuadre, transformEncuadre } from "./encuadre";

describe("encuadre de foto", () => {
  it("sin ajuste la foto no se mueve ni se amplía", () => {
    assert.deepEqual(encuadreDe(null), ENCUADRE_BASE);
    assert.equal(escalaEncuadre(ENCUADRE_BASE), 1);
    assert.equal(transformEncuadre(ENCUADRE_BASE), "translate(0%, 0%) rotate(0deg) scale(1)");
  });

  it("girar 90° agranda lo justo para no dejar huecos y un cuarto de vuelta vuelve al sitio", () => {
    const giro = encuadreDe({ zoom: 1, x: 0, y: 0, rot: 90 });
    assert.ok(Math.abs(escalaEncuadre(giro) - 1) < 1e-9);
    assert.ok(Math.abs(escalaEncuadre(giro, 4 / 5) - 1.25) < 1e-9);
    assert.ok(escalaEncuadre(encuadreDe({ rot: 8 })) < 1.2);
    assert.equal(encuadreDe({ rot: -90 }).rot, 270);
    assert.ok(Math.abs(escalaEncuadre(encuadreDe({ zoom: 2, rot: 180 })) - 2) < 1e-9);
  });

  it("recorta un zoom o un desplazamiento imposibles", () => {
    const enc = encuadreDe({ zoom: 9, x: 400, y: -20, rot: 15 });
    assert.equal(enc.zoom, 3);
    assert.equal(enc.x, 80);
    assert.equal(enc.y, -20);
    assert.equal(enc.rot, 15);
  });

  it("el volteo horizontal se conserva y el enderezo no salta de cuarto", () => {
    assert.equal(transformEncuadre({ voltear: true }), "translate(0%, 0%) rotate(0deg) scale(1) scaleX(-1)");
    assert.equal(encuadreDe({ voltear: false }).voltear, undefined);
    assert.equal(enderezarDe(100), 10);
    assert.equal(conEnderezar(100, -15), 75);
    assert.equal(enderezarDe(conEnderezar(90, 20)), 20);
  });
});
