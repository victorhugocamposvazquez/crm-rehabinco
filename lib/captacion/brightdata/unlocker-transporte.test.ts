import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esErrorTransporteUnlocker, motivoTransporteUnlocker } from "./unlocker-transporte";

describe("transporte Unlocker", () => {
  it("HTTP 400 con 30 bytes de zone not found", () => {
    const cuerpo = 'zone "crm_rehabinco" not found';
    assert.equal(new TextEncoder().encode(cuerpo).length, 30);
    const resp = {
      ok: false,
      http_status: 400,
      content_type: "application/json",
      cuerpo,
      bytes: 30,
    };
    assert.equal(esErrorTransporteUnlocker(resp), true);
    assert.equal(motivoTransporteUnlocker(resp), 'transporte: HTTP 400 · 30 bytes · zone "crm_rehabinco" not found');
  });

  it("200 con menos de 5000 bytes también es transporte", () => {
    const resp = { ok: true, http_status: 200, content_type: "text/html", cuerpo: "x", bytes: 4999 };
    assert.equal(esErrorTransporteUnlocker(resp), true);
  });
});
