import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  combinarRequisitos,
  numeroOpcional,
  payloadNuevaDemanda,
  validarNuevaDemanda,
  type BorradorNuevaDemanda,
} from "./nueva";

function borrador(parcial: Partial<BorradorNuevaDemanda> = {}): BorradorNuevaDemanda {
  return {
    clienteId: "cli-1",
    comercialId: "com-1",
    tipoOperacion: "compra",
    tiposInmueble: ["piso"],
    zonas: ["Oleiros"],
    presupuestoMin: "",
    presupuestoMax: "280000",
    superficieMin: "70",
    superficieMax: "",
    habitacionesMin: "3",
    banosMin: "1",
    requisitos: "Con luz",
    requisitosRapidos: ["Ascensor"],
    origen: "llamada",
    ...parcial,
  };
}

describe("nueva demanda", () => {
  it("exige cliente y comercial", () => {
    assert.equal(validarNuevaDemanda(borrador({ clienteId: "" })), "Elige o crea un cliente.");
    assert.equal(validarNuevaDemanda(borrador({ comercialId: "" })), "Asigna un comercial.");
    assert.equal(validarNuevaDemanda(borrador()), null);
  });

  it("rechaza rangos invertidos", () => {
    assert.match(validarNuevaDemanda(borrador({ presupuestoMin: "300000", presupuestoMax: "200000" })) ?? "", /presupuesto/);
    assert.match(validarNuevaDemanda(borrador({ superficieMin: "120", superficieMax: "80" })) ?? "", /m²/);
  });

  it("arma el payload que usa el matching", () => {
    const row = payloadNuevaDemanda(borrador());
    assert.equal(row.cliente_id, "cli-1");
    assert.equal(row.tipo_operacion, "compra");
    assert.deepEqual(row.tipos_inmueble, ["piso"]);
    assert.deepEqual(row.zonas, ["Oleiros"]);
    assert.equal(row.presupuesto_max, 280000);
    assert.equal(row.superficie_min, 70);
    assert.equal(row.habitaciones_min, 3);
    assert.equal(row.banos_min, 1);
    assert.equal(row.requisitos, "Ascensor. Con luz");
    assert.equal(row.origen, "llamada");
    assert.equal(row.estado, "activa");
  });

  it("acepta números con coma y deja vacíos en null", () => {
    assert.equal(numeroOpcional("1.250,5"), 1250.5);
    assert.equal(numeroOpcional(""), null);
    assert.equal(combinarRequisitos("  ", []), null);
  });
});
