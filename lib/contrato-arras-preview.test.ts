import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALTURA_UTIL_PAGINA_ARRAS, empaquetarBloquesEnPaginas, type BloqueMedido } from "./contrato-arras-preview";

function bloque(alto: number, opts?: Partial<BloqueMedido>): BloqueMedido {
  return {
    el: {} as HTMLElement,
    alto,
    evitarCorte: false,
    tituloSeccion: false,
    ...opts,
  };
}

describe("contrato arras preview", () => {
  it("no deja un título de sección solo al final de la hoja", () => {
    const medidas = [
      bloque(ALTURA_UTIL_PAGINA_ARRAS - 100),
      bloque(30, { tituloSeccion: true }),
      bloque(80),
      bloque(200),
    ];
    const pages = empaquetarBloquesEnPaginas(medidas);
    const idxTitulo = medidas.findIndex((m) => m.tituloSeccion);
    const paginaTitulo = pages.findIndex((p) => p.some((b) => b === medidas[idxTitulo]));
    const paginaSiguiente = pages.findIndex((p) => p.some((b) => b === medidas[idxTitulo + 1]));
    assert.equal(paginaTitulo, paginaSiguiente);
    assert.ok(paginaTitulo >= 0);
  });

  it("mantiene las firmas en bloque", () => {
    const medidas = [
      bloque(ALTURA_UTIL_PAGINA_ARRAS - 50),
      bloque(120, { evitarCorte: true }),
    ];
    const pages = empaquetarBloquesEnPaginas(medidas);
    assert.equal(pages.length, 2);
    assert.equal(pages[1]?.length, 1);
  });
});
