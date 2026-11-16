import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { puedeGestionarArchivo } from "./archivo";
import { fotosOrdenadas } from "./portada";
import { renderPublicacion } from "./publicacion-render";
import { datosPublicacion, escaparSvg, svgPublicacion } from "./publicacion-plantilla";
import { revisionDesdeMedia } from "./revision-media";
import { imagenDeRespuestaGemini } from "./retoque-respuesta";
import { PRESETS_RETOQUE, presetRetoque } from "./retoque-presets";
import type { InmuebleMedia } from "./catalogo";

const media: InmuebleMedia[] = [
  { id: "f", propiedad_id: "p", tipo: "foto", path: "p/f.jpg", url: "f.jpg", orden: 0, portada: true },
  { id: "r", propiedad_id: "p", tipo: "retocada", path: "p/retocadas/r.jpg", url: "r.jpg", orden: 0, portada: false, origen_id: "f", retoque: "luz" },
  { id: "pub", propiedad_id: "p", tipo: "publicacion", path: "p/publicaciones/a.png", url: "a.png", orden: 0, portada: false },
];

describe("archivo del piso", () => {
  it("el equipo comparte la carpeta y editor no", () => {
    assert.equal(puedeGestionarArchivo("comercial"), true);
    assert.equal(puedeGestionarArchivo("agente"), true);
    assert.equal(puedeGestionarArchivo("admin"), true);
    assert.equal(puedeGestionarArchivo("editor"), false);
    assert.equal(puedeGestionarArchivo("catastro_user"), false);
  });

  it("retoques y publicaciones no son fotos del anuncio", () => {
    assert.deepEqual(fotosOrdenadas(media).map((m) => m.id), ["f"]);
    assert.deepEqual(revisionDesdeMedia(media).foto.filas.map((f) => f.id), ["f"]);
  });

  it("los presets de retoque están cerrados", () => {
    assert.deepEqual(PRESETS_RETOQUE.map((p) => p.id), ["luz", "enderezar", "trastos", "cielo", "amueblar"]);
    assert.equal(presetRetoque("otro"), null);
    assert.match(presetRetoque("luz")?.prompt ?? "", /photorealistic/i);
  });

  it("lee la imagen que devuelve Gemini", () => {
    const hallada = imagenDeRespuestaGemini({
      candidates: [{ content: { parts: [{ text: "ok" }, { inlineData: { mimeType: "image/jpeg", data: "abc" } }] } }],
    });
    assert.deepEqual(hallada, { base64: "abc", mime: "image/jpeg" });
    assert.equal(imagenDeRespuestaGemini({ candidates: [] }), null);
  });

  it("rellena la plantilla con precio, municipio y metros", () => {
    const datos = datosPublicacion({
      titulo: "Piso <centro>",
      localidad: "A Coruña",
      tipo_operacion: "venta",
      precio_venta: 250000,
      superficie_m2: 98,
      habitaciones: 3,
      referencia: "RH-12",
    });
    assert.equal(datos.precio, "250.000 €");
    assert.equal(datos.detalle, "98 m² · 3 hab.");
    assert.equal(datos.localidad, "A Coruña");
    const svg = svgPublicacion("ig-cuadrado", datos);
    assert.match(svg, /250\.000 €/);
    assert.match(svg, /A Coruña/);
    assert.match(svg, /98 m²/);
    assert.equal(svg.includes("<centro>"), false);
    assert.match(svg, /width="1080"/);
    assert.equal(escaparSvg(`a & b`), "a &amp; b");
  });

  it("el alquiler lleva el precio al mes", () => {
    const datos = datosPublicacion({ tipo_operacion: "alquiler", precio_alquiler: 900, precio_venta: 10 });
    assert.equal(datos.precio, "900 € / mes");
  });

  it("compone un png del tamaño de la plantilla", async () => {
    const foto = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const png = await renderPublicacion({
      foto,
      plantillaId: "fb-post",
      ficha: { localidad: "A Coruña", tipo_operacion: "venta", precio_venta: 180000, superficie_m2: 70, habitaciones: 2, referencia: "RH-1" },
    });
    const meta = await sharp(png).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);
  });
});
