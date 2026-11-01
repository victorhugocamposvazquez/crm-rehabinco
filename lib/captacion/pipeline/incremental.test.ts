import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anuncioSinCambiosRelevantes, type PrevioIncremental } from "./incremental";
import { hashContenidoAnuncio } from "./upsert";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";

const base: AnuncioEntrante = {
  fuente: "idealista",
  portal_id: "idealista",
  externo_id: "999",
  url: "https://www.idealista.com/inmueble/999/",
  titulo: "Piso en Cambre",
  descripcion: "Bonito piso",
  operacion: "venta",
  tipo: "piso",
  anunciante: "particular",
  precio: 200000,
  superficie: 80,
  habitaciones: 3,
  banos: 1,
  planta: "3ª",
  direccion: null,
  zona: "Centro",
  municipio: "Cambre",
  codigo_postal: null,
  lat: 43.3,
  lng: -8.3,
  thumb: null,
  n_fotos: 5,
  contacto_nombre: "Fran",
  contacto_telefono: "+34600111222",
  publicado_en: null,
  raw: {},
};

function previoDe(entrante: AnuncioEntrante, extra?: Partial<PrevioIncremental>): PrevioIncremental {
  return {
    id: "uuid",
    portal_id: "idealista",
    externo_id: entrante.externo_id,
    precio: entrante.precio,
    tags: [],
    fase: "novedad",
    alerta_id: null,
    desaparecido_en: null,
    hash_contenido: hashContenidoAnuncio(entrante),
    titulo: entrante.titulo,
    descripcion: entrante.descripcion,
    contacto_telefono: entrante.contacto_telefono,
    contacto_nombre: entrante.contacto_nombre,
    municipio: entrante.municipio,
    zona: entrante.zona,
    lat: entrante.lat,
    lng: entrante.lng,
    anunciante: entrante.anunciante,
    superficie: entrante.superficie,
    habitaciones: entrante.habitaciones,
    banos: entrante.banos,
    planta: entrante.planta ?? null,
    tipo: entrante.tipo,
    operacion: entrante.operacion,
    ...extra,
  };
}

describe("anuncioSinCambiosRelevantes", () => {
  it("true si el anuncio no cambió", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), base), true);
  });

  it("false si bajó el precio", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, precio: 190000 }), false);
  });

  it("false si cambió la superficie", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, superficie: 95 }), false);
  });

  it("false si cambiaron baños o tipo", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, banos: 2 }), false);
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, tipo: "casa" }), false);
  });

  it("false si cambió la operación", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, operacion: "alquiler" }), false);
  });

  it("false si reaparece tras retirada", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base, { desaparecido_en: "2026-10-01T00:00:00.000Z" }), base),
      false
    );
  });

  it("false si cambia el teléfono", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base), { ...base, contacto_telefono: "+34600999888" }),
      false
    );
  });

  it("true si la pasada no trae teléfono pero el previo sí", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base), { ...base, contacto_telefono: null }),
      true
    );
  });

  it("true si el listado no trae descripción pero el previo (ficha) sí", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base), { ...base, descripcion: null }),
      true
    );
  });

  it("false si la descripción presente cambia", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base), { ...base, descripcion: "Reformado" }),
      false
    );
  });

  it("false si cambian coordenadas presentes", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, lat: 43.4 }), false);
  });

  it("true si el listado no trae lat (no borra la previa)", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base), { ...base, lat: null, lng: null }), true);
  });

  it("false sin hash previo (fuerza pipeline completo)", () => {
    assert.equal(anuncioSinCambiosRelevantes(previoDe(base, { hash_contenido: null }), base), false);
  });

  it("false si el barrio efectivo cambia", () => {
    assert.equal(
      anuncioSinCambiosRelevantes(previoDe(base, { zona: "Centro" }), { ...base, zona: "Eirís", municipio: "A Coruña" }),
      false
    );
  });
});
