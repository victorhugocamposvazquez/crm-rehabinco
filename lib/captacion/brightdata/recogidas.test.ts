import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listadoIncompleto } from "./recogidas";

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
});