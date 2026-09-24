import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parsearListadoIdealista } from "./parse-listado";

describe("parsearListadoIdealista", () => {
  it("saca un registro por anuncio, el profesional por /pro/ y la página siguiente", () => {
    const html = readFileSync(new URL("../../../tests/fixtures/idealista/oleiros-pagina-1.html", import.meta.url), "utf8");
    const listado = parsearListadoIdealista(html, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/");
    assert.equal(listado.items.length, 2);
    assert.equal(listado.items[0]?.externo_id, "112520691");
    assert.equal(listado.items[0]?.seller_type, "private");
    assert.equal(listado.items[0]?.price, 245000);
    assert.equal(listado.items[0]?.size, 92);
    assert.equal(listado.items[0]?.rooms, 3);
    assert.equal(listado.items[1]?.seller_type, "professional");
    assert.equal(listado.items[1]?.agency_name, "Fincas Norte");
    assert.equal(listado.next_url, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/pagina-2.htm");
    assert.equal(listado.final_url, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/");
    assert.equal(listado.sin_resultados, false);
  });
});
