import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { siguienteNumeroFacturaDesdeLista, validarFormatoNumeroFactura } from "./facturacion-numeracion.ts";

describe("validarFormatoNumeroFactura", () => {
  it("acepta ordinaria N/AAAA", () => {
    assert.equal(validarFormatoNumeroFactura("1/2026", false), null);
    assert.equal(validarFormatoNumeroFactura(" 42/2025 ", false), null);
  });

  it("rechaza ordinaria mal formada", () => {
    assert.match(validarFormatoNumeroFactura("", false)!, /Indica/);
    assert.match(validarFormatoNumeroFactura("FR-1/2026", false)!, /Formato/);
  });

  it("acepta rectificativa FR-N/AAAA", () => {
    assert.equal(validarFormatoNumeroFactura("FR-2/2026", true), null);
  });

  it("rechaza rectificativa mal formada", () => {
    assert.match(validarFormatoNumeroFactura("2/2026", true)!, /Formato/);
  });
});

describe("siguienteNumeroFacturaDesdeLista", () => {
  it("propone max+1 del ejercicio aunque el máximo venga de una factura editada", () => {
    const numeros = ["1/2026", "3/2026", "16/2026", "2/2025"];
    assert.equal(siguienteNumeroFacturaDesdeLista(numeros, { year: 2026, esRectificativa: false }), "17/2026");
  });

  it("ignora numeros de otro año", () => {
    assert.equal(
      siguienteNumeroFacturaDesdeLista(["99/2025"], { year: 2026, esRectificativa: false }),
      "1/2026"
    );
  });

  it("rectificativas en serie aparte", () => {
    assert.equal(
      siguienteNumeroFacturaDesdeLista(["FR-2/2026", "1/2026"], { year: 2026, esRectificativa: true }),
      "FR-3/2026"
    );
  });
});
