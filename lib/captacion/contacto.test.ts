import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveContacto, claveContactoCanonica, telefonoE164 } from "./contacto";

describe("claveContacto", () => {
  it("usa E.164 con prefijo tel:", () => {
    assert.equal(telefonoE164("600 111 222"), "+34600111222");
    assert.equal(claveContacto("600 111 222", "Ana", "Oleiros"), "tel:+34600111222");
  });

  it("sin teléfono usa nom:nombre|municipio normalizado", () => {
    assert.equal(claveContacto(null, "Tania", "Oleiros"), "nom:tania|oleiros");
  });

  it("canoniza claves legacy t: y n:", () => {
    assert.equal(claveContactoCanonica("t:34600111222"), "tel:+34600111222");
    assert.equal(claveContactoCanonica("n:tania|oleiros"), "nom:tania|oleiros");
  });
});
