import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENCUADRE_BASE, conEnderezar, encuadreDe, encuadreTocado, enderezarDe, escalaEncuadre, escalaPerspectiva, transformEncuadre } from "./encuadre";

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

  it("la perspectiva se queda en su eje y no cambia el plano si está a cero", () => {
    assert.equal(encuadreDe({ vertical: 0, horizontal: 0 }).vertical, undefined);
    assert.equal(encuadreDe({ vertical: 140 }).vertical, 100);
    assert.equal(encuadreDe({ horizontal: -20, zoom: 1.4, x: 4 }).horizontal, -20);
    assert.equal(escalaPerspectiva(ENCUADRE_BASE), 1);
    assert.equal(transformEncuadre({ vertical: 0 }), "translate(0%, 0%) rotate(0deg) scale(1)");
    assert.equal(encuadreTocado({ vertical: 25 }), true);
    assert.equal(encuadreTocado(ENCUADRE_BASE), false);
    const enc = encuadreDe({ vertical: -40, horizontal: 15 });
    assert.equal(encuadreDe({ ...enc, x: 10 }).vertical, -40);
    assert.equal(encuadreDe({ ...enc, vertical: 0 }).horizontal, 15);
    const t = transformEncuadre({ vertical: 100 }, 1, 1000);
    assert.equal(t, "translate(0%, 0%) rotate(0deg) scale(1.185) perspective(1350px) rotateX(30deg)");
    assert.match(transformEncuadre({ horizontal: -50 }, 1, 800), /perspective\(1080px\) rotateY\(-15deg\)/);
  });
});
