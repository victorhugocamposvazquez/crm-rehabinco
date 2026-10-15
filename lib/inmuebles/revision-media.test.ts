import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anadirArchivosRevision,
  quitarFilaRevision,
  reordenarFilasRevision,
  revisionDesdeMedia,
  revisionTieneCambios,
} from "./revision-media";
import type { InmuebleMedia } from "./catalogo";

const mediaBase: InmuebleMedia[] = [
  {
    id: "f1",
    propiedad_id: "p1",
    tipo: "foto",
    path: "p1/a.jpg",
    url: "https://x/a.jpg",
    orden: 0,
    portada: true,
  },
  {
    id: "f2",
    propiedad_id: "p1",
    tipo: "foto",
    path: "p1/b.jpg",
    url: "https://x/b.jpg",
    orden: 1,
    portada: false,
  },
];

describe("revision media inmueble", () => {
  it("detecta reordenación como cambio", () => {
    const base = revisionDesdeMedia(mediaBase);
    const movida = reordenarFilasRevision(base.foto, 1, 0);
    const actual = { ...base, foto: movida };
    assert.equal(revisionTieneCambios(actual, base), true);
  });

  it("añade archivos nuevos a la cola", () => {
    const base = revisionDesdeMedia(mediaBase);
    const file = new File(["x"], "n.jpg", { type: "image/jpeg" });
    const next = anadirArchivosRevision(base.foto, [file]);
    assert.equal(next.filas.length, 3);
    assert.equal(next.filas[2]?.origen, "nuevo");
  });

  it("marca borrado al quitar una fila guardada", () => {
    const base = revisionDesdeMedia(mediaBase);
    const next = quitarFilaRevision(base.foto, "f1");
    assert.equal(next.filas.length, 1);
    assert.equal(next.borrarIds.has("f1"), true);
  });
});
