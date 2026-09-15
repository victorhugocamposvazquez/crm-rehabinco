import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extraAlta } from "./alta-panel";

describe("extraAlta", () => {
  it("devuelve el resto de params si nueva=1", () => {
    const extra = extraAlta(new URLSearchParams("nueva=1&ofertante=abc"));
    assert.equal(extra?.get("ofertante"), "abc");
    assert.equal(extra?.has("nueva"), false);
  });

  it("ignora URLs sin alta", () => {
    assert.equal(extraAlta(new URLSearchParams("ofertante=abc")), null);
  });
});
