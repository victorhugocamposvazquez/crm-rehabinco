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
    const conGeo = listado.items.filter((item) => item.latitude != null && item.longitude != null);
    assert.ok(conGeo.length >= 20);
  });

  it("en el listado de un barrio, el que no trae zona en el título hereda la del listado", () => {
    const html = `
      <nav class="breadcrumb-list">
        <ul class="breadcrumb-navigation">
          <li class="breadcrumb-navigation-element inactive">
            <span itemprop="name">Eirís</span>
          </li>
        </ul>
      </nav>
      <article class="item" data-element-id="10001">
        <a class="item-link" href="/inmueble/10001/" title="Piso en Calle Compostela, A Coruña">Piso</a>
        <span class="item-price">100.000 €</span>
      </article>`;
    const listado = parsearListadoIdealista(html, "https://www.idealista.com/venta-viviendas/a-coruna/eiris/");
    assert.equal(listado.items[0]?.neighborhood, "Eirís");
    assert.equal(listado.items[0]?.municipality, "A Coruña");
  });
});
