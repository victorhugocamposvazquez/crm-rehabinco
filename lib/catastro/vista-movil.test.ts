import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANCHO_MOVIL_CATASTRO, CLASES_LISTA_BUSQUEDAS, MEDIA_MOVIL_CATASTRO } from "./vista-movil";

describe("vista-movil catastro", () => {
  it("cambia a móvil por debajo de 780px, como el prototipo", () => {
    assert.equal(ANCHO_MOVIL_CATASTRO, 780);
    assert.equal(MEDIA_MOVIL_CATASTRO, "(max-width: 779px)");
    assert.match(CLASES_LISTA_BUSQUEDAS, /gap-2\.5/);
    assert.match(CLASES_LISTA_BUSQUEDAS, /min-\[780px\]:rounded-2xl/);
  });
});
