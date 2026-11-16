import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { puedeGestionarArchivo } from "./archivo";
import { fotosOrdenadas } from "./portada";
import { renderPublicacion } from "./publicacion-render";
import { datosPublicacion, datosVisibles, escaparSvg, svgPublicacion } from "./publicacion-plantilla";
import { revisionDesdeMedia } from "./revision-media";
import { imagenDeRespuestaGemini } from "./retoque-respuesta";
import { anguloParaEnderezar, masLuz } from "./retoque-local";
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
    assert.equal(presetRetoque("luz")?.motor, "crm");
    assert.equal(presetRetoque("enderezar")?.motor, "crm");
    assert.equal(presetRetoque("trastos")?.motor, "ia");
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

  it("la plantilla solo pinta los datos que se dejan activos", () => {
    const ficha = { tipo_operacion: "venta" as const, precio_venta: 250000, superficie_m2: 98, habitaciones: 3, localidad: "A Coruña" };
    const visible = datosVisibles(ficha, { formato: "ig-cuadrado", estilo: "barra", campos: ["metros", "habitaciones"] });
    assert.equal(visible.precio, "");
    assert.equal(visible.detalle, "98 m² · 3 hab.");
    const svg = svgPublicacion("ig-cuadrado", visible);
    assert.equal(svg.includes("250.000"), false);
    assert.match(svg, /98 m²/);
  });

  it("el alquiler lleva el precio al mes", () => {
    const datos = datosPublicacion({ tipo_operacion: "alquiler", precio_alquiler: 900, precio_venta: 10 });
    assert.equal(datos.precio, "900 € / mes");
  });

  it("más luz aclara la foto sin llamar a una IA", async () => {
    const oscura = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#333333" } }).jpeg().toBuffer();
    const clara = await masLuz(oscura);
    const media = async (buf: Buffer) => {
      const { data } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
      return data.reduce((suma, valor) => suma + valor, 0) / data.length;
    };
    assert.ok((await media(clara)) > (await media(oscura)) + 8);
  });

  it("enderezar detecta una línea inclinada", async () => {
    const linea = await sharp({ create: { width: 360, height: 8, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const recta = await sharp({ create: { width: 360, height: 240, channels: 3, background: "#222222" } })
      .composite([{ input: linea, top: 116, left: 0 }])
      .jpeg()
      .toBuffer();
    const inclinada = await sharp(recta).rotate(3, { background: "#222222" }).jpeg().toBuffer();
    const angulo = await anguloParaEnderezar(inclinada);
    assert.ok(Math.abs(angulo - -3) <= 1, `angulo ${angulo}`);
  });

  it("compone un png del tamaño de la plantilla", async () => {
    const foto = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const png = await renderPublicacion({
      foto,
      plantilla: { formato: "fb-post", estilo: "barra", campos: ["precio", "localidad", "metros", "habitaciones"] },
      ficha: { localidad: "A Coruña", tipo_operacion: "venta", precio_venta: 180000, superficie_m2: 70, habitaciones: 2, referencia: "RH-1" },
    });
    const meta = await sharp(png).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);
  });
});
