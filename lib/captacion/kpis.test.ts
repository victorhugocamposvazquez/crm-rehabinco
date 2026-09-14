import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kpisCaptacion, kpisPorComercial } from "./kpis";

describe("kpis de captación", () => {
  it("calcula conversión finca → propiedad", () => {
    const kpis = kpisCaptacion({
      estados: ["nueva", "contactar", "en_stock", "descartada"],
      conPropiedad: 1,
      visitas: 2,
    });
    assert.equal(kpis.asignadas, 4);
    assert.equal(kpis.sinTrabajar, 1);
    assert.equal(kpis.enCurso, 1);
    assert.equal(kpis.conPropiedad, 1);
    assert.equal(kpis.visitas, 2);
    assert.equal(kpis.conversionPct, 25);
  });

  it("agrupa por comercial", () => {
    const filas = kpisPorComercial([
      { comercialId: "a", nombre: "Ana", propertyId: "p1" },
      { comercialId: "a", nombre: "Ana", propertyId: null },
      { comercialId: "b", nombre: "Brais", propertyId: null },
    ]);
    assert.equal(filas[0]?.nombre, "Ana");
    assert.equal(filas[0]?.asignadas, 2);
    assert.equal(filas[0]?.conversionPct, 50);
    assert.equal(filas[1]?.nombre, "Brais");
  });
});
