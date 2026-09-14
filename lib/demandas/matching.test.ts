import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encajaDemandaInmueble, matchingDemandas, matchingInmuebleDemandas, matchingPasaAVisitado } from "./matching";

const DEMANDA = {
  tipoOperacion: "compra",
  tiposInmueble: ["piso"],
  zonas: ["Oleiros"],
  presupuestoMin: 150000,
  presupuestoMax: 280000,
  superficieMin: 70,
  superficieMax: null,
  habitacionesMin: 3,
  banosMin: 1,
};

const PISO = {
  id: "p1",
  tipoOperacion: "venta",
  tipoInmueble: "piso",
  localidad: "Oleiros",
  codigoPostal: "15173",
  precioVenta: 270000,
  precioAlquiler: null,
  superficie: 90,
  habitaciones: 3,
  banos: 2,
  estado: "disponible",
};

describe("matching demanda ↔ inmueble", () => {
  it("encaja un piso de Oleiros dentro de presupuesto", () => {
    const r = encajaDemandaInmueble(DEMANDA, PISO);
    assert.equal(r.ok, true);
    assert.ok(r.puntuacion >= 70);
  });

  it("rechaza precio por encima del +10 %", () => {
    const r = encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: 400000 });
    assert.equal(r.ok, false);
  });

  it("compra encaja con venta, no con solo alquiler", () => {
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, tipoOperacion: "alquiler" }).ok, false);
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, tipoOperacion: "ambos" }).ok, true);
  });

  it("ordena por puntuación", () => {
    const lista = matchingDemandas(DEMANDA, [
      PISO,
      { ...PISO, id: "p2", localidad: "Arteixo" },
      { ...PISO, id: "p3", superficie: 95, precioVenta: 200000 },
    ]);
    assert.equal(lista.length, 2);
    assert.equal(lista[0]?.propiedadId, "p3");
  });

  it("desde el inmueble lista las demandas que encajan", () => {
    const lista = matchingInmuebleDemandas(PISO, [
      { ...DEMANDA, id: "d1" },
      { ...DEMANDA, id: "d2", zonas: ["Arteixo"] },
    ]);
    assert.equal(lista.length, 1);
    assert.equal(lista[0]?.demandaId, "d1");
  });

  it("al firmar la visita, propuesto y presentado pasan a visitado", () => {
    assert.equal(matchingPasaAVisitado("propuesto"), true);
    assert.equal(matchingPasaAVisitado("presentado"), true);
    assert.equal(matchingPasaAVisitado("descartado"), false);
  });
});
