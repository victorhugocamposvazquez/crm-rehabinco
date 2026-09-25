import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveContacto, esTelefonoVirtualIdealista } from "./contacto";
import { fusionarTelefono } from "./telefono";

describe("fusión de teléfono", () => {
  it("no pisa un teléfono bueno y normaliza el nuevo a E.164", () => {
    assert.deepEqual(fusionarTelefono("+34600111222", "981000000"), {
      telefono: "+34600111222",
      escrito: false,
    });
    assert.deepEqual(fusionarTelefono(null, "600 111 222"), {
      telefono: "+34600111222",
      escrito: true,
    });
    assert.deepEqual(fusionarTelefono(null, "no es un teléfono"), {
      telefono: null,
      escrito: false,
    });
  });

  it("número virtual no es clave de contacto y un real lo sustituye", () => {
    const virtual = "+348813512345";
    assert.ok(esTelefonoVirtualIdealista(virtual));
    assert.equal(claveContacto(virtual, "Ana", "Oleiros"), "nom:ana|oleiros");
    assert.deepEqual(fusionarTelefono(virtual, "600 111 222"), { telefono: "+34600111222", escrito: true });
  });
});
