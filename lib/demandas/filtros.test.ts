import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FILTRO_LISTADO_VACIO, hayFiltroListado, pasaFiltroDemanda, type FilaFiltroDemanda } from "./filtros";

const fila: FilaFiltroDemanda = {
  tipo_operacion: "compra",
  tipos_inmueble: ["piso", "chalet"],
  zonas: ["Oleiros", "A Coruña"],
  comercial_id: "iris",
  cliente: "Sonia Torres",
  comercial: "Iris Vázquez",
};

describe("filtros del listado de demandas", () => {
  it("sin filtros deja pasar la demanda", () => {
    assert.equal(pasaFiltroDemanda(fila, FILTRO_LISTADO_VACIO), true);
    assert.equal(hayFiltroListado(FILTRO_LISTADO_VACIO), false);
  });

  it("compra incluye también las de ambos, y ambos no incluye solo compra", () => {
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, operacion: "compra" }), true);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, operacion: "alquiler" }), false);
    assert.equal(pasaFiltroDemanda({ ...fila, tipo_operacion: "ambos" }, { ...FILTRO_LISTADO_VACIO, operacion: "alquiler" }), true);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, operacion: "ambos" }), false);
  });

  it("cruza tipo, zona, comercial y texto", () => {
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, tipo: "piso", zona: "Oleiros", comercialId: "iris" }), true);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, tipo: "local" }), false);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, zona: "Ferrol" }), false);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, q: "sonia" }), true);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, q: "coruña" }), true);
    assert.equal(pasaFiltroDemanda(fila, { ...FILTRO_LISTADO_VACIO, q: "iris" }), true);
    assert.equal(hayFiltroListado({ ...FILTRO_LISTADO_VACIO, q: "  " }), false);
    assert.equal(hayFiltroListado({ ...FILTRO_LISTADO_VACIO, tipo: "piso" }), true);
  });
});
