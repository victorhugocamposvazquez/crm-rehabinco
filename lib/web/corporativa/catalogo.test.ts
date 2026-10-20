import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combinarCatalogo, inmuebleCrmDe } from "./catalogo";
import { INMUEBLES_MOCK } from "./mock-inmuebles";

describe("catálogo corporativa", () => {
  it("pone el stock del CRM antes que los mocks", () => {
    const fila = inmuebleCrmDe({
      referencia: "RHB-2026-0003",
      titulo: "Bajo vivienda con jardín",
      localidad: "Oleiros",
      tipo_inmueble: "bajo",
      tipo_operacion: "venta",
      precio_venta: 369000,
      habitaciones: 2,
      banos: 2,
      superficie_m2: 75,
      descripcion: "Vivienda en Oleiros.",
      fotos: ["https://example.com/foto.jpg"],
    });
    assert.ok(fila);
    const lista = combinarCatalogo([fila], true);
    assert.equal(lista[0]?.origen, "crm");
    assert.equal(lista[0]?.slug, "RHB-2026-0003");
    assert.ok(lista.length > 1);
    assert.equal(lista.filter((i) => i.origen === "mock").length, INMUEBLES_MOCK.length);
  });
});
