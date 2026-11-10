import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sospechaRetirado, textoUltimaVezPortal, SOSPECHA_RETIRADO_MS } from "./sospecha-retirado";

describe("sospechaRetirado", () => {
  const ahora = new Date("2026-11-05T12:00:00.000Z");

  it("false si ya está retirado", () => {
    assert.equal(
      sospechaRetirado({ desaparecido_en: "2026-11-01T00:00:00.000Z", visto_en: "2026-10-01T00:00:00.000Z" }, ahora),
      false
    );
  });

  it("true si visto_en es viejo", () => {
    const viejo = new Date(ahora.getTime() - SOSPECHA_RETIRADO_MS - 60_000).toISOString();
    assert.equal(sospechaRetirado({ desaparecido_en: null, visto_en: viejo }, ahora), true);
  });

  it("false si visto reciente", () => {
    const reciente = new Date(ahora.getTime() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(sospechaRetirado({ desaparecido_en: null, visto_en: reciente }, ahora), false);
  });

  it("texto relativa", () => {
    const hace2h = new Date(ahora.getTime() - 2 * 60 * 60 * 1000).toISOString();
    assert.match(textoUltimaVezPortal(hace2h, ahora), /2 h/);
  });
});
