import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formDesdeInmueble, inmuebleDesdeForm } from "./catalogo";

describe("publicable en redes", () => {
  it("el alta guarda el check y sin marcar no sale", () => {
    assert.equal(formDesdeInmueble({}).publicar_redes, false);
    assert.equal(inmuebleDesdeForm(formDesdeInmueble({})).publicar_redes, false);
    const marcado = formDesdeInmueble({ publicar_redes: true });
    assert.equal(marcado.publicar_redes, true);
    assert.equal(inmuebleDesdeForm(marcado).publicar_redes, true);
  });
});
