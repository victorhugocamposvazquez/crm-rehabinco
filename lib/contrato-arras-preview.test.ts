import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALTURA_UTIL_PAGINA_ARRAS,
  MIN_HUECO_RELLENO_ARRAS,
  empaquetarBloquesEnPaginas,
  encontrarPrimerHuecoRellenable,
  partirSegmentosPorCaracteres,
  partirSegmentosPorPalabras,
  type BloqueMedido,
} from "./contrato-arras-preview";

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

  it("empaqueta bloques más altos que una hoja en página propia", () => {
    const gigante = bloque(ALTURA_UTIL_PAGINA_ARRAS + 200);
    const pages = empaquetarBloquesEnPaginas([bloque(100), gigante, bloque(80)]);
    assert.equal(pages.length, 3);
    assert.deepEqual(pages[1], [gigante]);
  });

  it("parte por palabras respetando cabida", () => {
    const limite = 12;
    const partes = partirSegmentosPorPalabras("uno dos tres cuatro cinco seis", (s) => s.length <= limite);
    assert.ok(partes.every((p) => p.length <= limite));
    assert.equal(partes.join(" "), "uno dos tres cuatro cinco seis");
  });

  it("parte palabras imposibles carácter a carácter", () => {
    const limite = 5;
    const token = "ABCDEFGHIJ";
    const partes = partirSegmentosPorPalabras(token, (s) => s.length <= limite);
    assert.ok(partes.length >= 2);
    assert.ok(partes.every((p) => p.length <= limite));
    assert.equal(partes.join(""), token);
  });

  it("partirSegmentosPorCaracteres nunca devuelve vacío", () => {
    const partes = partirSegmentosPorCaracteres("X", () => false);
    assert.equal(partes.length, 1);
    assert.equal(partes[0], "X");
  });

  it("detecta hueco rellenable cuando el bloque siguiente no cabe en el espacio restante", () => {
    const hueco = ALTURA_UTIL_PAGINA_ARRAS - 420;
    const previo = bloque(hueco);
    const novena = bloque(680);
    const medidas = [previo, novena];
    const hallado = encontrarPrimerHuecoRellenable(medidas);
    assert.ok(hallado);
    assert.equal(hallado.indiceBloque, 1);
    assert.equal(hallado.espacioRestante, 420);
  });

  it("ignora huecos demasiado pequeños", () => {
    const restante = MIN_HUECO_RELLENO_ARRAS - 10;
    const medidas = [bloque(ALTURA_UTIL_PAGINA_ARRAS - restante), bloque(500)];
    assert.equal(encontrarPrimerHuecoRellenable(medidas), null);
  });

  it("no intenta rellenar con bloques indivisibles", () => {
    const medidas = [
      bloque(ALTURA_UTIL_PAGINA_ARRAS - 200),
      bloque(120, { evitarCorte: true }),
    ];
    assert.equal(encontrarPrimerHuecoRellenable(medidas), null);
  });
});
