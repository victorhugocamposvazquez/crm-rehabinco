import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { esRespuestaTelefonoUnlockerValida } from "./unlocker-telefono";

describe("esRespuestaTelefonoUnlockerValida", () => {
  it("acepta JSON pequeño con phone1", () => {
    const cuerpo = readFileSync(new URL("../../../tests/fixtures/idealista/telefono-ejemplo.json", import.meta.url), "utf8");
    const bytes = new TextEncoder().encode(cuerpo).length;
    assert.ok(bytes < 500);
    assert.equal(
      esRespuestaTelefonoUnlockerValida({ ok: true, http_status: 200, content_type: "application/json", cuerpo, bytes }),
      true
    );
  });

  it("rechaza HTML aunque sea HTTP 200", () => {
    const cuerpo = "<!DOCTYPE html><html>captcha</html>";
    assert.equal(
      esRespuestaTelefonoUnlockerValida({
        ok: true,
        http_status: 200,
        content_type: "text/html",
        cuerpo,
        bytes: cuerpo.length,
      }),
      false
    );
  });
});
