import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONAS_IDEALISTA, ZONA_DESCONOCIDA, entraEnRetirados, urlSegunOperacion, zonaIdDeListado, zonaSuperaCorte, zonasPorDefecto, urlsDeZonas } from "./zonas";

describe("zonas Idealista", () => {
  it("usa un municipio por URL y deja las ciudades por debajo de 1.500", () => {
    const coruna = ZONAS_IDEALISTA.find((zona) => zona.id === "a-coruna");
    const santiago = ZONAS_IDEALISTA.find((zona) => zona.id === "santiago-de-compostela");
    const ferrol = ZONAS_IDEALISTA.find((zona) => zona.id === "ferrol");
    assert.equal(coruna?.url, "https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/");
    assert.equal(coruna?.anuncios, 968);
    assert.equal(santiago?.url, "https://www.idealista.com/venta-viviendas/santiago-de-compostela-a-coruna/");
    assert.equal(santiago?.anuncios, 502);
    assert.equal(ferrol?.url, "https://www.idealista.com/venta-viviendas/ferrol-a-coruna/");
    assert.equal(ferrol?.anuncios, 655);
    assert.equal(ZONAS_IDEALISTA.some((zona) => zona.id.includes("ensanche")), false);
    assert.ok(zonasPorDefecto().includes("a-coruna"));
    assert.ok(zonasPorDefecto().includes("oleiros"));
    assert.ok(ZONAS_IDEALISTA.some((zona) => zona.id === "carballo" && zona.porDefecto === false));
    assert.equal(urlsDeZonas(["oleiros"])[0], "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/");
    assert.equal(zonaSuperaCorte(1500), false);
    assert.equal(zonaSuperaCorte(1501), true);
    assert.equal(
      urlSegunOperacion(coruna?.url ?? "", "alquiler"),
      "https://www.idealista.com/alquiler-viviendas/a-coruna-a-coruna/"
    );
    assert.equal(zonaIdDeListado("https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/"), "a-coruna");
    assert.equal(entraEnRetirados(ZONA_DESCONOCIDA, ["a-coruna"]), false);
    assert.equal(entraEnRetirados("oleiros", ["oleiros"]), true);
  });
});
