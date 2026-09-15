import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { colorComercial } from "./tokens";

describe("colorComercial", () => {
  it("usa el color guardado o uno estable por id", () => {
    assert.equal(colorComercial("abc", "#0B7461"), "#0B7461");
    assert.equal(colorComercial("mismo-id"), colorComercial("mismo-id"));
    assert.match(colorComercial("sin-color"), /^#[0-9A-Fa-f]{6}$/);
  });
});
