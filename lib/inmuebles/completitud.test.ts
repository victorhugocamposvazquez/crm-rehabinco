import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completitudFicha } from "./completitud";

const BASE = {
  direccion: "Rúa Nova 1",
  localidad: "Oleiros",
  tipo_inmueble: "piso",
  tipo_operacion: "venta",
  precio_venta: 250000,
  precio_alquiler: null,
  superficie_m2: 90,
  superficie_util: 80,
  habitaciones: 3,
  descripcion: "Piso luminoso",
  ofertante_id: "c1",
  publicado: true,
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  tour_url: null,
};

describe("completitud de ficha", () => {
  it("una ficha llena con fotos, planos y vídeo está al 100 %", () => {
    const r = completitudFicha({ inmueble: BASE, fotos: 4, planos: 1 });
    assert.equal(r.porcentaje, 100);
    assert.equal(r.faltan.length, 0);
  });

  it("sin fotos ni descripción no está lista", () => {
    const r = completitudFicha({
      inmueble: { ...BASE, descripcion: null, publicado: false, video_url: null },
      fotos: 0,
      planos: 0,
    });
    assert.ok(r.porcentaje < 80);
    assert.ok(r.faltan.includes("Fotos"));
    assert.ok(r.faltan.includes("Planos"));
    assert.ok(r.faltan.includes("Vídeo o tour 3D"));
    assert.ok(r.faltan.includes("Descripción"));
  });
});
