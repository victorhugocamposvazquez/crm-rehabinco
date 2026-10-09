import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coincideBusqueda } from "./busqueda";

describe("búsqueda de captación", () => {
  it("encuentra Eirís aunque se escriba sin tilde", () => {
    const campos = ["Piso en Avenida de Pedralonga, 21, Eirís, A Coruña", "Eirís", "A Coruña"];
    assert.equal(coincideBusqueda("eiris", campos), true);
    assert.equal(coincideBusqueda("Eirís", campos), true);
    assert.equal(coincideBusqueda("pedralonga", campos), true);
    assert.equal(coincideBusqueda("oleiros", campos), false);
  });
});
