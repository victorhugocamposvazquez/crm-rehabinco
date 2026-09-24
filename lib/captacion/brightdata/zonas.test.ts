import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ZONAS_IDEALISTA, ZONA_DESCONOCIDA, distritoPorCoordenadas, entraEnRetirados, urlSegunOperacion, zonaIdDeListado, zonaSuperaCorte, zonasPorDefecto, urlsDeZonas } from "./zonas";

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
    assert.equal(urlsDeZonas(["oleiros"])[0]?.includes("/con-particulares/"), false);
    assert.equal(zonaSuperaCorte(1500), false);
    assert.equal(zonaSuperaCorte(1501), true);
    assert.equal(zonaSuperaCorte(null), false);
    const ensanche = ZONAS_IDEALISTA.find((zona) => zona.id === "a-coruna-ensanche-juan-florez");
    assert.equal(ensanche?.url, "https://www.idealista.com/venta-viviendas/a-coruna/ensanche-juan-florez/");
    assert.equal(ensanche?.operacion, "venta");
    assert.equal(
      urlSegunOperacion(ensanche?.url ?? "", "alquiler"),
      "https://www.idealista.com/alquiler-viviendas/a-coruna/ensanche-juan-florez/"
    );
    assert.equal(zonaIdDeListado("https://www.idealista.com/venta-viviendas/a-coruna/ensanche-juan-florez/"), "a-coruna-ensanche-juan-florez");
    assert.equal(ZONAS_IDEALISTA.find((zona) => zona.id === "a-coruna-viono")?.url.endsWith("/viono/"), true);
    assert.equal(ZONAS_IDEALISTA.find((zona) => zona.grupo === "Santiago")?.slugVerificado, false);
    assert.equal(entraEnRetirados("provincia-48h", ["oleiros", "provincia-48h"]), false);
    assert.equal(distritoPorCoordenadas("coruna", 43.3672, -8.4068), "a-coruna-ensanche-juan-florez");
    assert.equal(distritoPorCoordenadas("coruna", null, null), ZONA_DESCONOCIDA);
    assert.equal(entraEnRetirados(ZONA_DESCONOCIDA, ["a-coruna-ensanche-juan-florez"]), false);
    assert.equal(entraEnRetirados("oleiros", ["oleiros"]), true);
  });
});
