import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONAS_IDEALISTA, anunciosDeZonas, urlsDeZonas } from "./zonas";

describe("zonas Idealista", () => {
  it("incluye las localidades de la primera pasada y suma sus anuncios", () => {
    const ids = ZONAS_IDEALISTA.map((zona) => zona.id);
    assert.equal(ids.length, 14);
    assert.equal(anunciosDeZonas(ids), 4589);
    assert.equal(urlsDeZonas(["coruna", "ferrol"]).length, 2);
    assert.equal(urlsDeZonas([]).length, 14);
    assert.ok(urlsDeZonas(["coruna"])[0]?.endsWith("/con-particulares/"));
  });
});
