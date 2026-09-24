import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parsearListadoIdealista } from "./parse-listado";

describe("parsearListadoIdealista", () => {
  it("lee los 30 anuncios de Oleiros y deja fuera los article.adv", () => {
    const html = readFileSync(new URL("../../../tests/fixtures/idealista/oleiros-p1.html", import.meta.url), "utf8");
    const listado = parsearListadoIdealista(html, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/");
    const ids = new Set(listado.items.map((item) => item.externo_id));
    assert.equal(listado.items.length, 30);
    assert.equal(ids.size, 30);
    assert.ok(listado.items.every((item) => item.price != null && item.size != null));
    assert.equal(listado.next_url, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/pagina-2.htm");
  });
});
