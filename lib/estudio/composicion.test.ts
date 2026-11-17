import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { datosDePieza } from "./composicion";
import { initialCreativeState, type InmuebleEstudio } from "./data";

const inm: InmuebleEstudio = {
  id: "1", ref: "RHB-1", titulo: "Casa en Cambre", direccion: "Rúa Real 12", zona: "Cambre", barrio: "Cambre",
  precio: 698000, m2: 240, habitaciones: 6, banos: 6,
  agente: { nombre: "Iris", iniciales: "IS", color: "#123" },
  fotos: [
    { id: "a", url: "https://ejemplo.test/a.jpg", nombre: "Foto 1", tipo: "ext" },
    { id: "b", url: "https://ejemplo.test/b.jpg", nombre: "Foto 2", tipo: "int" },
  ],
};

describe("composición flexible", () => {
  it("una pieza de foto enseña esa foto, no la primera", () => {
    const datos = datosDePieza(inm, initialCreativeState, { tipo: "foto", foto: 1 }, "feed");
    assert.equal(datos.ph[0], 'url("https://ejemplo.test/b.jpg")');
  });

  it("un diseño distinto no hereda el titular editado de otro", () => {
    const st = { ...initialCreativeState, template: "hogar" as const, overrides: { titulo: "Llave entregada" } };
    const cierre = datosDePieza(inm, st, { tipo: "diseno", template: "visita" }, "post");
    const misma = datosDePieza(inm, st, { tipo: "diseno", template: "hogar" }, "post");
    assert.equal(cierre.f.titulo, "¿Quieres visitar esta vivienda?");
    assert.equal(misma.f.titulo, "Llave entregada");
  });
});
