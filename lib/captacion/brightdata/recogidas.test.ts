import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapearBrightDataIdealista } from "./idealista";
import { evaluarZonas, listadoIncompleto } from "./recogidas";

describe("cierre de recogida", () => {
  it("no retira si la última página está llena y había siguiente", () => {
    assert.equal(
      listadoIncompleto([{ zona_url: "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/", page: 60, items_en_pagina: 30 }]),
      true
    );
    assert.equal(
      listadoIncompleto([{ zona_url: "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/", page: 2, items_en_pagina: 12 }]),
      false
    );
  });

  it("marca vacía o caída y no cuenta una página sin bloque de anuncios como listado válido", () => {
    const oleiros = "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/";
    const vacia = evaluarZonas(
      [{ zona_url: oleiros, items_en_pagina: 0, sin_listado: false }],
      { oleiros: 40 }
    );
    assert.equal(vacia.sospechosas.oleiros, "vacia");
    const caida = evaluarZonas(
      [
        { zona_url: oleiros, externo_id: "10001", items_en_pagina: 2, sin_listado: false },
        { zona_url: oleiros, externo_id: "10002", items_en_pagina: 2, sin_listado: false },
      ],
      { oleiros: 10 }
    );
    assert.equal(caida.sospechosas.oleiros, "caida");
    assert.equal(caida.conteos.oleiros, 2);
    const rota = evaluarZonas(
      [{ zona_url: oleiros, sin_listado: true, final_url: oleiros, items_en_pagina: 0 }],
      {}
    );
    assert.equal(rota.sospechosas.oleiros, "pagina_invalida");
    const sana = evaluarZonas(
      Array.from({ length: 8 }, (_, i) => ({ zona_url: oleiros, externo_id: `2000${i}`, items_en_pagina: 8, sin_listado: false })),
      { oleiros: 10 }
    );
    assert.equal(sana.sospechosas.oleiros, undefined);
  });

  it("inserta 3 anuncios y trata el marcador de página como 0, no como anuncio", () => {
    const oleiros = "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/con-particulares/";
    const sada = "https://www.idealista.com/venta-viviendas/sada-a-coruna/con-particulares/";
    const filas = [
      ...[10111, 10112, 10113].map((id, i) => ({
        zona_url: oleiros,
        url: `https://www.idealista.com/inmueble/${id}/`,
        externo_id: String(id),
        title: "Piso en Oleiros",
        price: 150000,
        items_en_pagina: 3,
        sin_listado: false,
        listing_position: i + 1,
        floor_text: "3ª planta",
        seller_type: "private",
      })),
      { zona_url: sada, items_en_pagina: 0, sin_listado: false, final_url: sada, page: 1 },
    ];
    const anuncios = filas.map((fila) => mapearBrightDataIdealista(fila)).filter(Boolean);
    assert.equal(anuncios.length, 3);
    assert.equal(anuncios[0]?.planta, "3ª planta");
    const eval_ = evaluarZonas(filas, { oleiros: 4, sada: 20 });
    assert.equal(eval_.conteos.oleiros, 3);
    assert.equal(eval_.sospechosas.oleiros, undefined);
    assert.equal(eval_.conteos.sada, 0);
    assert.equal(eval_.sospechosas.sada, "vacia");
    const rota = evaluarZonas([{ zona_url: sada, items_en_pagina: 0, sin_listado: true }], {});
    assert.equal(rota.sospechosas.sada, "pagina_invalida");
  });
});