import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aptoParaWeb, contenidoDe, precioPublico, webPublicaDe } from "./modelo";

const PISO = {
  referencia: "RHB-2026-0001",
  titulo: "Piso en Juan Flórez",
  localidad: "A Coruña",
  descripcion: "Reformado, tres habitaciones.",
  tipo_operacion: "venta",
  precio_venta: 250000,
  precio_alquiler: null,
  estado: "disponible",
};

describe("escaparate web", () => {
  it("un piso con precio, localidad y descripción se puede publicar", () => {
    assert.equal(aptoParaWeb(PISO), true);
  });

  it("sin localidad o de baja no entra en la web", () => {
    assert.equal(aptoParaWeb({ ...PISO, localidad: "  " }), false);
    assert.equal(aptoParaWeb({ ...PISO, estado: "baja" }), false);
    assert.equal(aptoParaWeb({ ...PISO, tipo_operacion: "alquiler", precio_alquiler: null }), false);
  });

  it("el precio de alquiler lleva el mes", () => {
    assert.match(precioPublico({ tipo_operacion: "alquiler", precio_venta: null, precio_alquiler: 900 }), /900/);
    assert.match(precioPublico({ tipo_operacion: "alquiler", precio_venta: null, precio_alquiler: 900 }), /mes/);
  });

  it("un bloque guarda solo los textos y las fotos conocidas", () => {
    const contenido = contenidoDe({ titulo: "Hola", imagenes: [{ url: "https://cdn/a.jpg", alt: "Fachada" }, { url: "" }] });
    assert.equal(contenido.titulo, "Hola");
    assert.deepEqual(contenido.imagenes, [{ url: "https://cdn/a.jpg", alt: "Fachada" }]);
  });

  it("la respuesta pública descarta un inmueble incompleto", () => {
    const web = webPublicaDe({
      sitio: { diseno: "noche", publicado: true, marca: { nombre: "Rehabinco" } },
      bloques: [{ id: "1", tipo: "hero", orden: 1, contenido: { titulo: "Portada" } }],
      inmuebles: [PISO, { ...PISO, referencia: "RHB-2026-0002", descripcion: "" }],
    });
    assert.equal(web?.sitio.diseno, "noche");
    assert.equal(web?.inmuebles.length, 1);
    assert.equal(web?.bloques[0]?.contenido.titulo, "Portada");
  });
});
