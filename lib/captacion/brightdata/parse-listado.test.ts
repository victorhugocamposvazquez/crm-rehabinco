import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { barrioDeTitulo, parsearListadoIdealista } from "./parse-listado";

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

  it("guarda el barrio cuando el título no trae calle", () => {
    assert.deepEqual(barrioDeTitulo("Piso en Eirís, A Coruña"), { municipality: "A Coruña", neighborhood: "Eirís" });
    assert.deepEqual(barrioDeTitulo("Casa o chalet independiente en Eirís, A Coruña"), {
      municipality: "A Coruña",
      neighborhood: "Eirís",
    });
    assert.deepEqual(barrioDeTitulo("Piso en Calle de la Torre, 4, Eirís, A Coruña"), {
      municipality: "A Coruña",
      neighborhood: "Eirís",
    });
    assert.deepEqual(barrioDeTitulo("Piso en Calle Compostela, A Coruña"), {
      municipality: "A Coruña",
      neighborhood: null,
    });
    assert.deepEqual(barrioDeTitulo("Casa en Lugar Casal, Oleiros"), {
      municipality: "Oleiros",
      neighborhood: null,
    });
  });
});
