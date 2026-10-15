import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aptoParaWeb, contenidoDe, precioPublico, vistaPreviaDe, webPublicaDe, type BloqueWeb } from "./modelo";

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
    assert.equal(web?.sitio.marca.telefono, null);
    assert.equal(web?.inmuebles.length, 1);
    assert.equal(web?.bloques[0]?.contenido.titulo, "Portada");
  });

  it("el contacto antiguo de la marca pasa a ser el de Rehabinco", () => {
    const web = webPublicaDe({
      sitio: {
        diseno: "claro",
        publicado: true,
        marca: { nombre: "Rehabinco", telefono: "664 859 306", email: "oficina@rehabinco.com" },
      },
      bloques: [],
      inmuebles: [],
    });
    assert.equal(web?.sitio.marca.telefono, "664 85 93 06");
    assert.equal(web?.sitio.marca.email, "info@rehabinco.es");
  });

  it("la vista previa usa el borrador y omite el bloque oculto", () => {
    const hero: BloqueWeb = {
      id: "hero",
      tipo: "hero",
      orden: 1,
      visible: true,
      contenido: contenidoDe({ titulo: "Guardado" }),
    };
    const texto: BloqueWeb = { ...hero, id: "texto", tipo: "texto", visible: false };
    const vista = vistaPreviaDe({
      diseno: "claro",
      marca: { nombre: "Rehabinco", telefono: null, email: null, web: null, logo: null },
      bloques: [hero, texto],
      borradores: { hero: contenidoDe({ titulo: "Al escribir" }) },
      inmuebles: [],
    });
    assert.equal(vista.sitio.publicado, true);
    assert.equal(vista.bloques.length, 1);
    assert.equal(vista.bloques[0]?.contenido.titulo, "Al escribir");
  });
});
