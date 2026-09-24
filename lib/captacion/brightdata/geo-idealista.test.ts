import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coordsListadoIdealista } from "./geo-idealista";

describe("coordsListadoIdealista", () => {
  it("lee center del carrusel en Oleiros", () => {
    const html = readFileSync(new URL("../../../tests/fixtures/idealista/oleiros-p1.html", import.meta.url), "utf8");
    const mapa = coordsListadoIdealista(html);
    assert.ok(mapa.size >= 20);
    const geo = mapa.get("112310385");
    assert.ok(geo);
    assert.ok(Math.abs(geo!.latitude - 43.3414855) < 0.001);
    assert.ok(Math.abs(geo!.longitude + 8.3517692) < 0.001);
  });
});
