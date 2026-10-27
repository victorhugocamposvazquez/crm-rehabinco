import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coincideTelefonoBusqueda, digitosBusqueda } from "./busqueda";

describe("busqueda teléfono", () => {
  it("quita espacios y signos", () => {
    assert.equal(digitosBusqueda("+34 600 123 456"), "34600123456");
  });

  it("encuentra número con espacios buscando junto", () => {
    assert.equal(coincideTelefonoBusqueda("600 123 456", "600123456"), true);
  });

  it("encuentra número junto buscando con espacios", () => {
    assert.equal(coincideTelefonoBusqueda("600123456", "600 123 456"), true);
  });

  it("no confunde otro número", () => {
    assert.equal(coincideTelefonoBusqueda("600 123 456", "600999888"), false);
  });
});
