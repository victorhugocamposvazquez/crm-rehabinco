import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agregarCoberturaTerritorio } from "./cobertura";

describe("cobertura territorial", () => {
  it("agrupa búsquedas por CP y se queda con el máximo de calles", () => {
    const filas = agregarCoberturaTerritorio([
      {
        mode: "POSTAL_CODE",
        postalCode: "15009",
        municipio: "A Coruña",
        provincia: "A Coruña",
        streetsFound: 127,
        streetsProcessed: 53,
        complete: false,
        updatedAt: "2026-09-10T10:00:00.000Z",
      },
      {
        mode: "POSTAL_CODE",
        postalCode: "15009",
        municipio: "A Coruña",
        provincia: "A Coruña",
        streetsFound: 127,
        streetsProcessed: 127,
        complete: true,
        updatedAt: "2026-09-12T10:00:00.000Z",
      },
      {
        mode: "STREET",
        postalCode: "15001",
        streetsFound: 1,
        streetsProcessed: 1,
        complete: true,
      },
    ]);
    assert.equal(filas.length, 1);
    assert.equal(filas[0]?.postalCode, "15009");
    assert.equal(filas[0]?.streetsProcessed, 127);
    assert.equal(filas[0]?.complete, true);
  });
});
