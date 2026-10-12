import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluarCaducidadCapa } from "./data-health";

describe("evaluarCaducidadCapa", () => {
  it("marca caducada OSM a los 5 meses", () => {
    const now = Date.UTC(2026, 5, 1);
    const loaded = new Date(Date.UTC(2026, 0, 1)).toISOString();
    const r = evaluarCaducidadCapa("osm", loaded, now);
    assert.equal(r.stale, true);
    assert.equal(r.maxMonths, 4);
  });

  it("INE admite 13 meses", () => {
    const now = Date.UTC(2027, 0, 1);
    const loaded = new Date(Date.UTC(2026, 0, 1)).toISOString();
    const r = evaluarCaducidadCapa("ine_sections", loaded, now);
    assert.equal(r.stale, false);
  });
});
