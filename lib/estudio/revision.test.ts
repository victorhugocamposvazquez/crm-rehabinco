import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nombreCorto, publicacionGuardada, textoRevision } from "./revision";

describe("revisión del Estudio", () => {
  it("avisa a dirección con el inmueble y el tipo", () => {
    const aviso = textoRevision({ autor: "Lucía", referencia: "RB-120", formato: "reel" });
    assert.equal(aviso.titulo, "Nueva publicación del Estudio");
    assert.equal(aviso.cuerpo, "Lucía pide revisión del diseño de RB-120 (Reel).");
    assert.equal(aviso.url, "/estudio/revisiones");
  });

  it("recupera un diseño guardado y descarta uno roto", () => {
    const ok = publicacionGuardada({
      format: "feed",
      slides: [{ id: "s1", template: "hogar" }],
    });
    assert.equal(ok?.format, "feed");
    assert.equal(publicacionGuardada({ format: "feed", slides: [] }), null);
    assert.equal(publicacionGuardada(null), null);
  });

  it("usa el nombre de pila o el correo", () => {
    assert.equal(nombreCorto("Ana Ruiz", "ana@rehabinco.es"), "Ana");
    assert.equal(nombreCorto("  ", "lucia@rehabinco.es"), "lucia");
    assert.equal(nombreCorto(null, null), "Marketing");
  });
});
