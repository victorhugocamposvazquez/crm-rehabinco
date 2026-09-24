import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluarZonas, listadoIncompleto } from "./recogidas";

describe("cierre de recogida", () => {
  it("no retira si la última página está llena y había siguiente", () => {
    assert.equal(
      listadoIncompleto([{ listing_url: "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/", page: 2, page_items: 30, has_next_page: true }]),
      true
    );
    assert.equal(
      listadoIncompleto([{ listing_url: "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/", page: 2, page_items: 12, has_next_page: false }]),
      false
    );
  });

  it("marca vacía o caída y no cuenta una página sin bloque de anuncios como listado válido", () => {
    const oleiros = "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/";
    const vacia = evaluarZonas(
      [{ listing_url: oleiros, page_items: 0, sin_listado: false }],
      { oleiros: 40 }
    );
    assert.equal(vacia.sospechosas.oleiros, "vacia");
    const caida = evaluarZonas(
      [
        { listing_url: oleiros, externo_id: "10001" },
        { listing_url: oleiros, externo_id: "10002" },
      ],
      { oleiros: 10 }
    );
    assert.equal(caida.sospechosas.oleiros, "caida");
    assert.equal(caida.conteos.oleiros, 2);
    const rota = evaluarZonas(
      [{ listing_url: oleiros, sin_listado: true, final_url: oleiros, page_items: 0 }],
      {}
    );
    assert.equal(rota.sospechosas.oleiros, "pagina_invalida");
    const sana = evaluarZonas(
      Array.from({ length: 8 }, (_, i) => ({ listing_url: oleiros, externo_id: `2000${i}` })),
      { oleiros: 10 }
    );
    assert.equal(sana.sospechosas.oleiros, undefined);
  });
});