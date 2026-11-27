import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formDesdeInmueble, inmuebleDesdeForm } from "./catalogo";

describe("no publicable", () => {
  it("sale en el Estudio salvo que se marque como no publicable", () => {
    assert.equal(formDesdeInmueble({}).publicar_redes, true);
    assert.equal(inmuebleDesdeForm(formDesdeInmueble({})).publicar_redes, true);
    const excluido = formDesdeInmueble({ publicar_redes: false });
    assert.equal(excluido.publicar_redes, false);
    assert.equal(inmuebleDesdeForm(excluido).publicar_redes, false);
  });
});
