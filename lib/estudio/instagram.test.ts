import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCreativeData, initialCreativeState, type InmuebleEstudio } from "./data";
import { repartoInstagram, textoInstagram } from "./instagram";

const inm: InmuebleEstudio = {
  id: "1", ref: "RHB-1", titulo: "Casa en Cambre", direccion: "Rúa Real 12", zona: "Cambre", barrio: "Cambre",
  precio: 698000, m2: 240, habitaciones: 6, banos: 6, energia: "C",
  agente: { nombre: "Iris", iniciales: "IS", color: "#123" },
  fotos: [{ id: "f", url: "https://ejemplo.test/a.jpg", nombre: "Foto 1", tipo: "ext" }],
};

describe("plantillas de portada y visita", () => {
  it("el titular de Tu nuevo hogar no pisa el título de la ficha si no se ha editado", () => {
    const pieza = buildCreativeData(inm, { ...initialCreativeState, template: "hogar" });
    assert.equal(pieza.f.titulo, "Tu nuevo hogar");
    const editado = buildCreativeData(inm, { ...initialCreativeState, template: "hogar", overrides: { titulo: "Llave entregada" } });
    assert.equal(editado.f.titulo, "Llave entregada");
    const galeria = buildCreativeData(inm, initialCreativeState);
    assert.equal(galeria.f.titulo, "Casa en Cambre");
  });

  it("la visita lleva la pregunta y el subtítulo de la pieza", () => {
    const pieza = buildCreativeData(inm, { ...initialCreativeState, template: "visita" });
    assert.equal(pieza.f.titulo, "¿Quieres visitar esta vivienda?");
    assert.equal(pieza.f.cta, "Contacta con nosotros y descubre tu próximo hogar.");
  });
});

describe("reparto de instagram", () => {
  it("la story no entra en el carrusel del feed", () => {
    assert.deepEqual(repartoInstagram(["story", "post", "fb"]), { feed: ["post", "fb"], historia: ["story"] });
  });

  it("el texto solo incluye lo que se ve", () => {
    const texto = textoInstagram({
      titulo: "Tu nuevo hogar", zona: "Cambre", precio: "698.000 €", tel: "664 85 93 06",
      tituloVisible: true, zonaVisible: true, precioVisible: false, telVisible: true,
    });
    assert.equal(texto.includes("698"), false);
    assert.equal(texto.includes("Cambre"), true);
  });
});
