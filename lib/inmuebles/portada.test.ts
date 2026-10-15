import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fotosOrdenadas, sincronizarPortadaMemoria, urlPortadaDeMedia } from "./portada";
import type { InmuebleMedia } from "./catalogo";

describe("portada inmueble", () => {
  it("usa la foto de menor orden, no el flag suelto", () => {
    const media = [
      { id: "a", url: "a.jpg", tipo: "foto", orden: 1, portada: true, propiedad_id: "p", path: "", },
      { id: "b", url: "b.jpg", tipo: "foto", orden: 0, portada: false, propiedad_id: "p", path: "", },
    ] as InmuebleMedia[];
    assert.equal(urlPortadaDeMedia(media), "b.jpg");
    const sync = sincronizarPortadaMemoria(media);
    assert.equal(sync.find((m) => m.id === "b")?.portada, true);
    assert.equal(sync.find((m) => m.id === "a")?.portada, false);
  });

  it("ordena fotos por campo orden", () => {
    const ids = fotosOrdenadas([
      { tipo: "foto", orden: 2, url: "c" },
      { tipo: "foto", orden: 0, url: "a" },
      { tipo: "plano", orden: 0, url: "p" },
    ]).map((m) => m.url);
    assert.deepEqual(ids, ["a", "c"]);
  });
});
