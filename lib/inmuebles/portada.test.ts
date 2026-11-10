import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fotosOrdenadas, sincronizarPortadaMemoria, urlFotoInmuebleVisible, urlPortadaDeMedia } from "./portada";
import type { InmuebleMedia } from "./catalogo";

describe("portada inmueble", () => {
  it("usa la foto de menor orden, no el flag suelto", () => {
    const media = [
      { id: "a", url: "a.jpg", tipo: "foto", orden: 1, portada: true, propiedad_id: "p", path: "", },
      { id: "b", url: "b.jpg", tipo: "foto", orden: 0, portada: false, propiedad_id: "p", path: "", },
    ] as InmuebleMedia[];
    // URLs locales no pasan por el proxy de marca.
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

  it("marca fotos del bucket público de inmuebles", () => {
    const origen =
      "https://xxxx.supabase.co/storage/v1/object/public/inmuebles/p1/foto.jpg";
    const marcada = urlFotoInmuebleVisible(origen);
    assert.ok(marcada?.includes("/api/media/marca?u="));
    assert.ok(marcada?.includes(encodeURIComponent(origen)));
  });
});
