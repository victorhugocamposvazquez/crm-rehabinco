import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accionTecladoLista, ANCHO_MOVIL_CATASTRO, CLASES_LISTA_BUSQUEDAS, MEDIA_MOVIL_CATASTRO } from "./vista-movil";

describe("vista-movil catastro", () => {
  it("cambia a móvil por debajo de 780px, como el prototipo", () => {
    assert.equal(ANCHO_MOVIL_CATASTRO, 780);
    assert.equal(MEDIA_MOVIL_CATASTRO, "(max-width: 779px)");
    assert.match(CLASES_LISTA_BUSQUEDAS, /gap-2\.5/);
    assert.match(CLASES_LISTA_BUSQUEDAS, /min-\[780px\]:rounded-2xl/);
  });

  it("cierra la ficha con Escape y se mueve con flechas", () => {
    assert.equal(accionTecladoLista("ArrowDown"), "siguiente");
    assert.equal(accionTecladoLista("ArrowUp"), "anterior");
    assert.equal(accionTecladoLista("Escape"), "cerrar");
    assert.equal(accionTecladoLista("Enter"), "abrir");
    assert.equal(accionTecladoLista("j"), "siguiente");
    assert.equal(accionTecladoLista("k"), "anterior");
  });
});
