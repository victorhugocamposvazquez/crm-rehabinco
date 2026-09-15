import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buscarMunicipios, etiquetaMunicipio, MIN_LETRAS_LOCALIDAD } from "./municipios";

describe("municipios España", () => {
  it("no busca hasta tres letras", () => {
    assert.equal(MIN_LETRAS_LOCALIDAD, 3);
    assert.deepEqual(buscarMunicipios("ol"), []);
    assert.deepEqual(buscarMunicipios("  ma  "), []);
  });

  it("encuentra localidades de toda España, no solo Coruña", () => {
    const oleiros = buscarMunicipios("ole");
    assert.equal(oleiros.some((m) => m.nombre === "Oleiros" && m.provincia === "A Coruña"), true);

    const madrid = buscarMunicipios("mad");
    assert.equal(madrid.some((m) => m.nombre === "Madrid"), true);

    const sevilla = buscarMunicipios("sev");
    assert.equal(sevilla.some((m) => m.nombre === "Sevilla"), true);

    const coruna = buscarMunicipios("cor");
    assert.equal(coruna.some((m) => m.nombre === "A Coruña"), true);
  });

  it("distingue homónimos con la provincia", () => {
    const mieres = buscarMunicipios("mie");
    const provincias = new Set(mieres.filter((m) => m.nombre === "Mieres").map((m) => m.provincia));
    if (provincias.size > 1) {
      const uno = mieres.find((m) => m.nombre === "Mieres");
      assert.equal(etiquetaMunicipio(uno!).includes("("), true);
    }
  });
});
