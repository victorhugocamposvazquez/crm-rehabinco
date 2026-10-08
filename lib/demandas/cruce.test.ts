import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cuentaEncajesPerfectos, evaluarCruce, ordenarCruce, type DemandaParaCruce, type InmuebleParaCruce } from "./cruce";

const DEMANDA: DemandaParaCruce = {
  tipoOperacion: "compra",
  tiposInmueble: ["piso"],
  presupuestoMin: null,
  presupuestoMax: 250000,
  zonas: ["Ensanche"],
  habitacionesMin: null,
  superficieMin: null,
  superficieMax: null,
  banosMin: null,
  pideAscensor: false,
};

function piso(parcial: Partial<InmuebleParaCruce> = {}): InmuebleParaCruce {
  return {
    tipoOperacion: "venta",
    tipoInmueble: "piso",
    localidad: "Ensanche",
    precio: 235000,
    superficie: 92,
    habitaciones: 3,
    banos: 2,
    ascensor: true,
    ...parcial,
  };
}

describe("evaluar cruce", () => {
  it("el listado cuenta los que encajan del todo, no los ya asignados", () => {
    const sonia: DemandaParaCruce = {
      ...DEMANDA,
      tiposInmueble: ["piso", "chalet"],
      zonas: [],
      presupuestoMax: 620000,
    };
    const maria: DemandaParaCruce = { ...DEMANDA, zonas: [], presupuestoMax: 250000 };
    const stock = [
      piso({ tipoOperacion: "ambos", tipoInmueble: "chalet", localidad: "coruña", precio: 450000 }),
      piso({ tipoOperacion: "venta", tipoInmueble: "piso", localidad: "A Coruña Capital", precio: 435000 }),
    ];
    assert.equal(cuentaEncajesPerfectos(sonia, stock), 2);
    assert.equal(cuentaEncajesPerfectos(maria, stock), 0);
  });

  it("sin zona encaja un chalet en compra si el tipo y el precio cuadran", () => {
    const r = evaluarCruce(
      piso({ tipoOperacion: "ambos", tipoInmueble: "chalet", localidad: "coruña", precio: 450000 }),
      { ...DEMANDA, tiposInmueble: ["piso", "chalet"], zonas: [], presupuestoMax: 620000 }
    );
    assert.equal(r.perfect, true);
  });

  it("un piso dentro de presupuesto y de zona encaja del todo si no hay más criterios", () => {
    const r = evaluarCruce(piso(), DEMANDA);
    assert.equal(r.perfect, true);
    assert.equal(r.near, false);
  });

  it("marca casi encaje si el precio se pasa como mucho un 10 %", () => {
    const justo = evaluarCruce(piso({ precio: 265000 }), DEMANDA);
    assert.equal(justo.perfect, false);
    assert.equal(justo.near, true);
    assert.match(justo.checks.find((c) => !c.ok)?.label ?? "", /sobre presupuesto/);
    const lejos = evaluarCruce(piso({ precio: 310000 }), DEMANDA);
    assert.equal(lejos.near, false);
  });

  it("un solo fallo leve de habitaciones o metros es casi encaje", () => {
    const estricta = { ...DEMANDA, habitacionesMin: 3, superficieMin: 80, zonas: ["Centro"] };
    const hab = evaluarCruce(piso({ localidad: "Centro", habitaciones: 2, superficie: 85 }), estricta);
    assert.equal(hab.near, true);
    const metros = evaluarCruce(piso({ localidad: "Centro", habitaciones: 3, superficie: 78 }), estricta);
    assert.equal(metros.near, true);
    const dos = evaluarCruce(piso({ localidad: "Os Mallos", habitaciones: 3, superficie: 78 }), estricta);
    assert.equal(dos.near, false);
    assert.equal(dos.perfect, false);
  });

  it("una localidad contenida en otra zona no basta: tiene que coincidir el sitio", () => {
    const coruna = evaluarCruce(
      piso({ localidad: "coruña", tipoInmueble: "chalet" }),
      { ...DEMANDA, tiposInmueble: ["piso", "chalet"], zonas: ["Oleiros"], presupuestoMax: 620000 }
    );
    assert.equal(coruna.perfect, false);
    assert.equal(coruna.near, false);
  });

  it("tipo u operación distintos no son casi encaje", () => {
    assert.equal(evaluarCruce(piso({ tipoInmueble: "atico" }), DEMANDA).near, false);
    assert.equal(evaluarCruce(piso({ tipoOperacion: "alquiler" }), DEMANDA).perfect, false);
  });

  it("el mínimo de presupuesto, los baños y el ascensor cuentan", () => {
    const estricta = { ...DEMANDA, presupuestoMin: 200000, banosMin: 2, pideAscensor: true };
    assert.equal(evaluarCruce(piso(), estricta).perfect, true);
    const barato = evaluarCruce(piso({ precio: 170000 }), estricta);
    assert.equal(barato.perfect, false);
    assert.equal(barato.near, false);
    const cerca = evaluarCruce(piso({ precio: 185000 }), estricta);
    assert.equal(cerca.near, true);
    const sinBanos = evaluarCruce(piso({ banos: 1 }), estricta);
    assert.equal(sinBanos.near, true);
    const sinAscensor = evaluarCruce(piso({ ascensor: false }), estricta);
    assert.equal(sinAscensor.perfect, false);
    assert.equal(sinAscensor.near, false);
  });

  it("si faltan precio, metros o habitaciones no desaparece: queda como casi", () => {
    const sinPrecio = evaluarCruce(piso({ precio: null }), DEMANDA);
    assert.equal(sinPrecio.perfect, false);
    assert.equal(sinPrecio.near, true);
    const sinVarios = evaluarCruce(piso({ precio: null, habitaciones: null, superficie: null }), {
      ...DEMANDA,
      habitacionesMin: 3,
      superficieMin: 80,
    });
    assert.equal(sinVarios.perfect, false);
    assert.equal(sinVarios.near, true);
    const faltaYZona = evaluarCruce(piso({ precio: null, localidad: "Oleiros" }), DEMANDA);
    assert.equal(faltaYZona.near, false);
  });

  it("garaje, terraza y exterior filtran, y sin indicar queda como casi", () => {
    const pide = { ...DEMANDA, pideGaraje: true, pideTerraza: true, pideExterior: true };
    assert.equal(evaluarCruce(piso({ garaje: true, terraza: true, exterior: true }), pide).perfect, true);
    const sinDecir = evaluarCruce(piso(), pide);
    assert.equal(sinDecir.perfect, false);
    assert.equal(sinDecir.near, true);
    const sinGaraje = evaluarCruce(piso({ garaje: false, terraza: true, exterior: true }), pide);
    assert.equal(sinGaraje.perfect, false);
    assert.equal(sinGaraje.near, false);
  });

  it("rechaza por encima de los metros máximos", () => {
    const r = evaluarCruce(piso({ superficie: 140 }), { ...DEMANDA, superficieMax: 100 });
    assert.equal(r.perfect, false);
    assert.equal(r.near, false);
  });

  it("ordena novedades primero y, a igualdad, el más barato", () => {
    const lista = ordenarCruce(
      [
        { id: "a", isNew: false, precio: 100 },
        { id: "b", isNew: true, precio: 300 },
        { id: "c", isNew: true, precio: 200 },
      ],
      "recent"
    );
    assert.deepEqual(lista.map((f) => f.id), ["c", "b", "a"]);
  });
});
