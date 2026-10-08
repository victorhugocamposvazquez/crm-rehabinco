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
  it("sin zona encaja si el resto cuadra", () => {
    assert.equal(encajaDemandaInmueble({ ...DEMANDA, zonas: [] }, PISO).ok, true);
  });

  it("encaja un piso de Oleiros dentro de presupuesto", () => {
    const r = encajaDemandaInmueble(DEMANDA, PISO);
    assert.equal(r.ok, true);
    assert.ok(r.puntuacion >= 70);
  });

  it("rechaza precio por encima del +10 % y por debajo del mínimo", () => {
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: 400000 }).ok, false);
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: 120000 }).ok, false);
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: 150000 }).ok, true);
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

  it("un inmueble disponible encaja aunque no esté marcado como visible", () => {
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, publicado: false }).ok, true);
  });

  it("el precio por encima del presupuesto no encaja, igual que en la ficha", () => {
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: 308000 }).ok, false);
  });

  it("si la demanda pide ascensor, un inmueble sin él no encaja", () => {
    assert.equal(encajaDemandaInmueble({ ...DEMANDA, requisitos: "Ascensor" }, { ...PISO, ascensor: false }).ok, false);
    assert.equal(encajaDemandaInmueble({ ...DEMANDA, requisitos: "Ascensor" }, { ...PISO, ascensor: true }).ok, true);
  });

  it("garaje, terraza y exterior solo cuentan como encaje si el inmueble los tiene", () => {
    const pide = { ...DEMANDA, requisitos: "Garaje. Terraza. Exterior" };
    assert.equal(encajaDemandaInmueble(pide, { ...PISO, garaje: true, terraza: true, exterior: true }).ok, true);
    assert.equal(encajaDemandaInmueble(pide, { ...PISO, garaje: false, terraza: true, exterior: true }).ok, false);
    assert.equal(encajaDemandaInmueble(pide, PISO).ok, false);
  });

  it("rechaza metros por encima del máximo y la falta de precio o superficie", () => {
    assert.equal(encajaDemandaInmueble({ ...DEMANDA, superficieMax: 80 }, PISO).ok, false);
    assert.equal(encajaDemandaInmueble({ ...DEMANDA, superficieMax: 100 }, PISO).ok, true);
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, precioVenta: null }).ok, false);
    assert.equal(encajaDemandaInmueble(DEMANDA, { ...PISO, superficie: null }).ok, false);
    assert.equal(
      encajaDemandaInmueble(
        { ...DEMANDA, presupuestoMin: null, presupuestoMax: null, superficieMin: null, superficieMax: null },
        { ...PISO, precioVenta: null, superficie: null }
      ).ok,
      true
    );
  });

  it("al firmar la visita, propuesto y presentado pasan a visitado", () => {
    assert.equal(matchingPasaAVisitado("propuesto"), true);
    assert.equal(matchingPasaAVisitado("presentado"), true);
    assert.equal(matchingPasaAVisitado("descartado"), false);
  });
});
