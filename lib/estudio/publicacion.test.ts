import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templatesForGoal } from "./config";
import { buildSlideData, initialPublication, makeSlide, nextUnusedPhoto } from "./publicacion";
import type { InmuebleEstudio } from "./data";

const inm: InmuebleEstudio = {
  id: "1", ref: "RHB-1", titulo: "Piso en Monte Alto", direccion: "Calle Real 4", zona: "Monte Alto", barrio: "Monte Alto",
  precio: 325000, m2: 90, habitaciones: 3, banos: 2, agente: { nombre: "Ana", iniciales: "A", color: "#111" },
  fotos: [
    { id: "a", url: "https://ejemplo.test/a.jpg", nombre: "Foto 1", tipo: "ext" },
    { id: "b", url: "https://ejemplo.test/b.jpg", nombre: "Salón", tipo: "int" },
    { id: "c", url: "https://ejemplo.test/c.jpg", nombre: "Cocina", tipo: "int" },
  ],
};

describe("publicación de pantallas", () => {
  it("la siguiente foto salta la portada y las que ya están", () => {
    const pub = initialPublication();
    pub.slides.push(makeSlide("foto", 1));
    assert.equal(nextUnusedPhoto(pub, 3), 2);
  });

  it("hogar pone el titular por defecto y deja el teléfono visible", () => {
    const pub = initialPublication("hogar");
    const data = buildSlideData(inm, pub, pub.slides[0]);
    assert.equal(data.f.titulo, "Tu nuevo hogar");
    assert.equal(data.sh.tel, true);
    assert.equal(data.f.tel, "664 85 93 06");
  });

  it("visita no hereda el titular de hogar", () => {
    const pub = initialPublication("visita");
    pub.slides[0].overrides = {};
    const data = buildSlideData(inm, pub, pub.slides[0]);
    assert.equal(data.f.titulo, "¿Quieres visitar esta vivienda?");
    assert.equal(data.f.cta, "Contacta con nosotros y descubre tu próximo hogar.");
  });

  it("una foto con nombre genérico no pinta «Foto 1»", () => {
    const slide = makeSlide("foto", 0);
    const data = buildSlideData(inm, initialPublication(), slide);
    assert.equal(data.f.pie, "");
    assert.equal(data.sh.pie, false);
  });

  it("una foto de estancia guarda el nombre, oculto hasta que se enseña", () => {
    const slide = makeSlide("foto", 1);
    const data = buildSlideData(inm, initialPublication(), slide);
    assert.equal(data.f.pie, "Salón");
    assert.equal(data.sh.pie, false);
  });

  it("el encuadre de una foto se queda en su pantalla", () => {
    const pub = initialPublication("visita");
    pub.slides[0].encuadre = { 0: { zoom: 1.4, x: 8, y: -3, rot: 90 } };
    const data = buildSlideData(inm, pub, pub.slides[0]);
    assert.equal(data.encuadre?.[0]?.zoom, 1.4);
    assert.equal(data.encuadre?.[0]?.rot, 90);
    assert.equal(buildSlideData(inm, pub, makeSlide("visita")).encuadre?.[0], undefined);
  });

  it("la tipografía de un texto en Feed no cambia la de Post", () => {
    const pub = initialPublication("hogar");
    pub.tipografia = { feed: { titulo: "impacto" } };
    const feed = buildSlideData(inm, pub, pub.slides[0]);
    const post = buildSlideData(inm, { ...pub, format: "post" }, pub.slides[0]);
    assert.equal(feed.fuentes.titulo, "impacto");
    assert.equal(post.fuentes.titulo, undefined);
  });

  it("el tamaño de Feed no cambia el de Post", () => {
    const pub = initialPublication("hogar");
    pub.escala = { feed: { titulo: 1.4 } };
    const feed = buildSlideData(inm, pub, pub.slides[0]);
    const post = buildSlideData(inm, { ...pub, format: "post" }, pub.slides[0]);
    assert.equal(feed.escala.titulo, 1.4);
    assert.equal(post.escala.titulo, undefined);
  });

  it("la galería no ofrece las plantillas retiradas", () => {
    const ids = templatesForGoal("nuevo", { includeSlideOnly: true }).map((t) => t.id);
    for (const id of ["plano", "contactos", "collage", "arco", "xxl", "moodboard", "triptico", "formas"]) {
      assert.equal(ids.includes(id), false);
    }
    assert.equal(ids.includes("galeria"), true);
    assert.equal(ids.includes("portada"), true);
  });
});
