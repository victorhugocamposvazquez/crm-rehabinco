import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parsearTelefonoIdealista } from "./parse-telefono";

describe("teléfono Idealista", () => {
  it("contrato del JSON de contact-phones", () => {
    const cuerpo = readFileSync(new URL("../../../tests/fixtures/idealista/telefono-ejemplo.json", import.meta.url), "utf8");
    const parsed = parsearTelefonoIdealista(cuerpo, "112637603");
    assert.equal(parsed.transporte_ok, true);
    assert.equal(parsed.externo_id, "112637603");
    assert.deepEqual(parsed.telefonos, ["+34881350992", "+34665548144"]);
  });

  it("HTML o captcha es fallo de transporte", () => {
    const parsed = parsearTelefonoIdealista("<html>captcha</html>");
    assert.equal(parsed.transporte_ok, false);
    assert.equal(parsed.telefonos.length, 0);
  });
});
