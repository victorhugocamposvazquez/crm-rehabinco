import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etiquetaEstado, nombreCorto, publicacionGuardada, textoDecision, textoRevision } from "./revision";

describe("revisión del Estudio", () => {
  it("avisa a dirección con el inmueble y el tipo", () => {
    const aviso = textoRevision({ autor: "Lucía", referencia: "RB-120", formato: "reel", id: "abc" });
    assert.equal(aviso.titulo, "Solicitud de revisión de diseño");
    assert.equal(aviso.cuerpo, "Lucía pide revisión del diseño de RB-120 (Reel).");
    assert.equal(aviso.url, "/estudio/revisiones/abc");
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

  it("avisa al editor si el diseño se aprueba o hay que rectificarlo", () => {
    const ok = textoDecision({
      decision: "aprobada",
      referencia: "RB-120",
      motivo: "",
      id: "abc",
      propiedadId: "piso",
    });
    assert.equal(ok.titulo, "Diseño aprobado");
    assert.equal(ok.url, "/estudio/revisiones/abc");
    const cambio = textoDecision({
      decision: "rectificar",
      referencia: "RB-120",
      motivo: "El precio no se lee.",
      id: "abc",
      propiedadId: "piso",
    });
    assert.equal(cambio.titulo, "Hay que rectificar el diseño");
    assert.equal(cambio.cuerpo, "Hugo pide cambios en RB-120. El precio no se lee.");
    assert.equal(cambio.url, "/estudio?inmueble=piso&revision=abc");
    assert.equal(etiquetaEstado("rectificar"), "A rectificar");
    assert.equal(etiquetaEstado("aprobada"), "Aprobada");
  });

  it("usa el nombre de pila o el correo", () => {
    assert.equal(nombreCorto("Ana Ruiz", "ana@rehabinco.es"), "Ana");
    assert.equal(nombreCorto("  ", "lucia@rehabinco.es"), "lucia");
    assert.equal(nombreCorto(null, null), "Marketing");
  });
});
