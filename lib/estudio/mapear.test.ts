import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captionFacts, captionFallback, type CaptionRequest } from "./caption";
import { mapearInmuebleEstudio } from "./mapear";

const fila = {
  id: "11111111-1111-1111-1111-111111111111",
  referencia: "RHB-14",
  titulo: "Ático en Monte Alto",
  direccion: "Rúa Real 12",
  localidad: "A Coruña",
  tipo_operacion: "venta",
  precio_venta: 250000,
  precio_alquiler: null,
  superficie_m2: 98,
  superficie_construida: null,
  habitaciones: 3,
  banos: 2,
  certificado_energetico: "C",
  comercial_id: "22222222-2222-2222-2222-222222222222",
  user_id: "22222222-2222-2222-2222-222222222222",
};

describe("estudio", () => {
  it("rellena la creatividad con los datos de la ficha", () => {
    const inm = mapearInmuebleEstudio(
      fila,
      [{ id: "f1", propiedad_id: fila.id, url: "https://ejemplo.test/a.jpg", orden: 1 }],
      { id: fila.user_id, nombre_completo: "Iris Seoane", color: "#123456" }
    );
    assert.equal(inm.ref, "RHB-14");
    assert.equal(inm.precio, 250000);
    assert.equal(inm.m2, 98);
    assert.equal(inm.habitaciones, 3);
    assert.equal(inm.banos, 2);
    assert.equal(inm.energia, "C");
    assert.equal(inm.zona, "A Coruña");
    assert.equal(inm.agente.iniciales, "IS");
    assert.equal(inm.fotos[0]?.nombre, "Foto 1");
  });

  it("el texto de la publicación no menciona un dato oculto", () => {
    const pedido: CaptionRequest = {
      inmueble: {
        ref: "RHB-14",
        titulo: "Ático",
        direccion: "Rúa Real 12",
        zona: "A Coruña",
        barrio: "Monte Alto",
        precio: 250000,
        m2: 98,
        habitaciones: 3,
        banos: 2,
        energia: "C",
        agente: "Iris",
      },
      canal: "instagram",
      tono: "cercano",
      objetivo: "Nuevo",
      visibles: ["titulo", "zona", "m2"],
      soloZona: true,
    };
    const texto = [...captionFacts(pedido), captionFallback(pedido)].join("\n");
    assert.equal(texto.includes("250"), false);
    assert.equal(texto.includes("Rúa Real"), false);
    assert.equal(texto.includes("98"), true);
  });
});
