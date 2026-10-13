import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validarFormatoNumeroFactura } from "./facturacion-numeracion.ts";

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
