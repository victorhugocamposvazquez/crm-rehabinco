import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alertaDuplicadoFinca,
  coincideFiltroBandeja,
  diasDesdeAsignacion,
  parseEstadoCaptacion,
  recuentoBandejaCaptacion,
  textoAging,
} from "./estados";

describe("estados de captación", () => {
  it("normaliza estados desconocidos a nueva", () => {
    assert.equal(parseEstadoCaptacion("visita"), "visita");
    assert.equal(parseEstadoCaptacion("otro"), "nueva");
    assert.equal(parseEstadoCaptacion(null), "nueva");
  });

  it("filtra la bandeja por ciclo comercial, no por DH", () => {
    assert.equal(coincideFiltroBandeja("nueva", "SIN_TRABAJAR", false), true);
    assert.equal(coincideFiltroBandeja("nueva", "SIN_TRABAJAR", true), false);
    assert.equal(coincideFiltroBandeja("contactar", "EN_CURSO", false), true);
    assert.equal(coincideFiltroBandeja("en_stock", "CON_PROPIEDAD", false), true);
    assert.equal(coincideFiltroBandeja("descartada", "CERRADAS", false), true);
    assert.equal(coincideFiltroBandeja("nueva", "CERRADAS", false), false);
  });

  it("cuenta aging desde la asignación", () => {
    assert.equal(diasDesdeAsignacion("2026-09-10T08:00:00.000Z", "2026-09-14"), 4);
    assert.equal(textoAging(0), "Hoy");
    assert.equal(textoAging(1), "1 día");
    assert.equal(textoAging(4), "4 días");
  });

  it("avisa si la RC ya es propiedad o ya está asignada", () => {
    assert.equal(alertaDuplicadoFinca({ propertyId: "p1" }).tipo, "propiedad");
    assert.equal(alertaDuplicadoFinca({ asignadaA: "c2", yo: "c1" }).tipo, "asignada");
    assert.equal(alertaDuplicadoFinca({ asignadaA: "c1", yo: "c1" }).texto?.includes("te está asignada"), true);
    assert.equal(alertaDuplicadoFinca({}).tipo, null);
  });

  it("recuenta la bandeja", () => {
    const recuento = recuentoBandejaCaptacion([
      { estado: "nueva", propertyId: null },
      { estado: "contactar", propertyId: null },
      { estado: "en_stock", propertyId: "p1" },
      { estado: "descartada", propertyId: null },
    ]);
    assert.equal(recuento.TODAS, 4);
    assert.equal(recuento.SIN_TRABAJAR, 1);
    assert.equal(recuento.EN_CURSO, 1);
    assert.equal(recuento.CON_PROPIEDAD, 1);
    assert.equal(recuento.CERRADAS, 1);
  });
});
