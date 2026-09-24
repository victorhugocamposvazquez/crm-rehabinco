import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONAS_IDEALISTA, zonaSuperaCorte, zonasPorDefecto, urlsDeZonas } from "./zonas";

describe("zonas Idealista", () => {
  it("parte A Coruña, Santiago y Ferrol y deja el resto de la provincia desmarcado", () => {
    const ids = new Set(ZONAS_IDEALISTA.map((zona) => zona.id));
    assert.equal(ids.has("coruna"), false);
    assert.equal(ids.has("santiago"), false);
    assert.equal(ids.has("ferrol"), false);
    assert.ok(ZONAS_IDEALISTA.some((zona) => zona.grupo === "A Coruña" && zona.nombre.startsWith("Ensanche")));
    assert.ok(ZONAS_IDEALISTA.some((zona) => zona.grupo === "Santiago"));
    assert.ok(ZONAS_IDEALISTA.some((zona) => zona.grupo === "Ferrol"));
    assert.ok(ZONAS_IDEALISTA.some((zona) => zona.id === "carballo" && zona.porDefecto === false));
    assert.ok(zonasPorDefecto().includes("oleiros"));
    assert.equal(zonasPorDefecto().some((id) => id.startsWith("a-coruna-")), false);
    assert.ok(urlsDeZonas(["oleiros"])[0]?.endsWith("/con-particulares/"));
    assert.equal(zonaSuperaCorte(1500), false);
    assert.equal(zonaSuperaCorte(1501), true);
    assert.equal(zonaSuperaCorte(null), false);
  });
});
