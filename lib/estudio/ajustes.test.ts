import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anidarEscala, anidarPos, buildCreativeData, initialCreativeState, type InmuebleEstudio } from "./data";

const inm: InmuebleEstudio = {
  id: "1", ref: "RHB-1", titulo: "Ático", direccion: "Rúa Real 12", zona: "A Coruña", barrio: "Monte Alto",
  precio: 250000, m2: 98, habitaciones: 3, banos: 2, energia: "C",
  agente: { nombre: "Iris", iniciales: "IS", color: "#123" },
  fotos: [{ id: "f", url: "https://ejemplo.test/a.jpg", nombre: "Foto 1", tipo: "int" }],
};

describe("ajustes por formato", () => {
  it("un tamaño guardado sin formato se queda en el post", () => {
    const plano = { titulo: 1.4 };
    assert.equal(anidarEscala(plano).post?.titulo, 1.4);
    assert.equal(anidarEscala(plano).story, undefined);
  });

  it("el post y la story no comparten tamaño ni posición", () => {
    const st = {
      ...initialCreativeState,
      format: "story" as const,
      escala: { post: { titulo: 1.5 }, story: { titulo: 1.1 } },
      pos: { post: { titulo: { x: 8, y: 4 } }, story: { zona: { x: 2, y: 9 } } },
    };
    const story = buildCreativeData(inm, st);
    const post = buildCreativeData(inm, { ...st, format: "post" });
    assert.equal(story.escala.titulo, 1.1);
    assert.equal(story.pos.titulo, undefined);
    assert.equal(story.pos.zona?.y, 9);
    assert.equal(post.escala.titulo, 1.5);
    assert.equal(post.pos.titulo?.x, 8);
    assert.equal(post.pos.zona, undefined);
  });

  it("una posición antigua no se copia a la story", () => {
    const anidada = anidarPos({ titulo: { x: 3, y: 1 } });
    assert.deepEqual(anidada.post?.titulo, { x: 3, y: 1 });
    assert.equal(anidada.story, undefined);
    const otra = anidarPos(anidada);
    assert.deepEqual(otra, anidada);
  });
});
