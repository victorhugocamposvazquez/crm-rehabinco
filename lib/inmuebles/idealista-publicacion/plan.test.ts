import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idAnuncioIdealista, rutasPublicacionIdealista } from "./api";
import { etiquetaEstadoIdealista, planSyncIdealista } from "./plan";

describe("planSyncIdealista", () => {
  it("espera la API si el inmueble está marcado y aún no hay credenciales", () => {
    const plan = planSyncIdealista({
      publicar: true,
      motivos: [],
      anuncios: 1,
      apiLista: false,
      tieneAnuncio: false,
    });
    assert.equal(plan.accion, "marcar_espera");
  });

  it("no publica una ficha incompleta", () => {
    const plan = planSyncIdealista({
      publicar: true,
      motivos: ["fotos"],
      anuncios: 0,
      apiLista: true,
      tieneAnuncio: false,
    });
    assert.equal(plan.accion, "incompleto");
  });

  it("publica cuando la API está lista", () => {
    const plan = planSyncIdealista({
      publicar: true,
      motivos: [],
      anuncios: 1,
      apiLista: true,
      tieneAnuncio: false,
    });
    assert.equal(plan.accion, "publicar");
  });

  it("deja la baja pendiente si se desmarca antes de tener API", () => {
    const plan = planSyncIdealista({
      publicar: false,
      motivos: [],
      anuncios: 0,
      apiLista: false,
      tieneAnuncio: true,
    });
    assert.equal(plan.accion, "baja_pendiente");
  });
});

describe("etiqueta y rutas", () => {
  it("etiqueta la espera", () => {
    assert.equal(etiquetaEstadoIdealista("esperando_api", true), "Idealista · esperando API");
    assert.equal(etiquetaEstadoIdealista("publicado", true), "En Idealista");
  });

  it("monta las rutas bajo la URL que envíe Idealista", () => {
    const rutas = rutasPublicacionIdealista("https://partners.example/v1/");
    assert.equal(rutas.crear, "https://partners.example/v1/properties");
    assert.equal(rutas.actualizar("abc"), "https://partners.example/v1/properties/abc");
    assert.equal(idAnuncioIdealista({ propertyId: 99 }), "99");
  });
});
