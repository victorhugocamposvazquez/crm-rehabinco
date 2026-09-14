import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { agregarCoberturaTerritorio, busquedaCoberturaDesdeFila } from "./cobertura";

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

  it("lee las columnas persistidas, no un JSON criteria", () => {
    const mapeada = busquedaCoberturaDesdeFila({
      mode: "POSTAL_CODE",
      postal_code: "15009",
      municipio: "A CORUÑA",
      provincia: "A CORUÑA",
      coverage: { streetsFound: 127, streetsProcessed: 40, complete: false },
      status: "COMPLETED",
      updated_at: "2026-09-14T10:00:00.000Z",
    });
    assert.equal(mapeada.postalCode, "15009");
    assert.equal(mapeada.streetsProcessed, 40);
    const ruta = join(dirname(fileURLToPath(import.meta.url)), "../../app/api/catastro/cobertura/route.ts");
    const fuente = readFileSync(ruta, "utf8");
    assert.equal(fuente.includes("criteria"), false);
    assert.match(fuente, /postal_code, municipio, provincia/);
  });
});
