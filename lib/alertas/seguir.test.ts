import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tituloAjeno } from "./seguir";

describe("título de un aviso ajeno", () => {
  it("pone el nombre delante", () => {
    assert.equal(tituloAjeno("Iris", "Empieza en 60 min · Evento"), "Iris · Empieza en 60 min · Evento");
  });

  it("no deja el «tus» cuando el aviso es de otra persona", () => {
    assert.equal(tituloAjeno("Iris", "Tus tareas del día"), "Iris · tareas del día");
  });
});
