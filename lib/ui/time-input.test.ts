import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { horaDesdeDigitosPegado, horasCompletas } from "./time-input";

describe("TimeInput helpers", () => {
  it("detecta horas completas", () => {
    assert.equal(horasCompletas("15:00"), true);
    assert.equal(horasCompletas("9:00"), false);
  });

  it("formatea pegado 1530", () => {
    assert.equal(horaDesdeDigitosPegado("1530", ""), "15:30");
    assert.equal(horaDesdeDigitosPegado("15:30", "15:00"), null);
  });
});
