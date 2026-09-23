import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { desaparecidosTrasSync, upsertAnuncio } from "./upsert";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";

const base: AnuncioEntrante = {
  fuente: "habitaclia",
  portal_id: "habitaclia",
  externo_id: "123",
  url: "https://example.com/123",
  titulo: "Piso en Cambre",
  descripcion: "Bonito piso",
  operacion: "venta",
  tipo: "piso",
  anunciante: "particular",
  precio: 200000,
  superficie: 80,
  habitaciones: 3,
  banos: 1,
  direccion: null,
  zona: null,
  municipio: "Cambre",
  codigo_postal: null,
  lat: null,
  lng: null,
  thumb: null,
  n_fotos: 5,
  contacto_nombre: "Fran",
  contacto_telefono: "600111222",
  publicado_en: null,
  raw: {},
};

describe("upsertAnuncio", () => {
  it("detecta alta, bajada e historial", () => {
    const alta = upsertAnuncio(null, base, "2026-09-15T08:00:00.000Z", "a1");
    assert.equal(alta.esNuevo, true);
    assert.equal(alta.row.contacto_clave, "tel:+34600111222");

    const previo = {
      id: "uuid",
      portal_id: "habitaclia",
      externo_id: "123",
      precio: 200000,
      hash_contenido: "old",
      tags: [],
      fase: "novedad" as const,
      alerta_id: "a1",
      desaparecido_en: null,
      titulo: "Piso en Cambre",
    };
    const bajada = upsertAnuncio(
      previo,
      { ...base, precio: 190000, titulo: "Piso reformado en Cambre" },
      "2026-09-15T09:00:00.000Z",
      "a1"
    );
    assert.equal(bajada.eventos.some((e) => e.tipo === "bajada"), true);
    assert.ok(bajada.historial.some((h) => h.campo === "precio"));
  });

  it("actualiza raw_path y parser_version en filas existentes", () => {
    const previo = {
      id: "uuid",
      portal_id: "habitaclia",
      externo_id: "123",
      precio: 200000,
      hash_contenido: "old",
      raw_path: null,
      parser_version: null,
      tags: [],
      fase: "novedad" as const,
      alerta_id: "a1",
      desaparecido_en: null,
    };
    const patch = upsertAnuncio(previo, base, "2026-09-17T10:00:00.000Z", "a1", {
      rawPath: "habitaclia/Girona/raw.html",
      parserVersion: "habitaclia-test",
    });
    assert.equal(patch.esNuevo, false);
    assert.equal(patch.row.raw_path, "habitaclia/Girona/raw.html");
    assert.equal(patch.row.parser_version, "habitaclia-test");
    assert.equal(patch.row.visto_en, "2026-09-17T10:00:00.000Z");
    assert.notEqual(patch.row.hash_contenido, "old");
  });

  it("conserva el teléfono guardado si la nueva pasada no lo trae", () => {
    const previo = {
      id: "uuid",
      portal_id: "idealista",
      externo_id: "123",
      precio: 200000,
      tags: [],
      fase: "novedad" as const,
      alerta_id: null,
      desaparecido_en: null,
      contacto_telefono: "+34600111222",
      contacto_nombre: "Fran",
    };
    const patch = upsertAnuncio(previo, { ...base, contacto_telefono: null }, "2026-09-23T10:00:00.000Z", null);
    assert.equal(patch.row.contacto_telefono, "+34600111222");
    assert.equal(patch.row.contacto_clave, "tel:+34600111222");
  });

  it("marca desaparecidos por portal_id", () => {
    const fuera = desaparecidosTrasSync(
      [
        {
          id: "a",
          portal_id: "habitaclia",
          externo_id: "1",
          precio: 1,
          tags: [],
          fase: "novedad",
          alerta_id: null,
          desaparecido_en: null,
        },
      ],
      [],
      "2026-09-15T10:00:00.000Z"
    );
    assert.equal(fuera.length, 1);
  });
});
