import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { desgloseCostePorProducto, rangoMesUtc, sumarCoste, sumarCosteUnlocker } from "./saldo";

describe("gasto Bright Data", () => {
  it("cierra el mes en UTC y deja el día final fuera", () => {
    const rango = rangoMesUtc(new Date("2026-09-23T22:00:00.000Z"));
    assert.equal(rango.from, "2026-09-01");
    assert.equal(rango.to, "2026-10-01");
    assert.match(rango.etiqueta, /septiembre/i);
    assert.match(rango.etiqueta, /2026/);
  });

  it("suma el coste de cada producto y cada día", () => {
    assert.equal(
      sumarCoste({
        "2026-09-01": { scraper_studio: 12.5, browser: 1.25 },
        "2026-09-02": { scraper_studio: 0.2 },
      }),
      13.95
    );
    assert.equal(sumarCoste(null), 0);
    assert.equal(sumarCoste([]), 0);
  });

  it("separa Unlocker del resto de productos", () => {
    const cuerpo = {
      "2026-09-01": { web_unlocker: 2.5, scraper_studio: 20, browser: 1 },
    };
    assert.equal(desgloseCostePorProducto(cuerpo).web_unlocker, 2.5);
    assert.equal(sumarCosteUnlocker(cuerpo), 2.5);
    assert.equal(sumarCoste(cuerpo), 23.5);
  });
});
