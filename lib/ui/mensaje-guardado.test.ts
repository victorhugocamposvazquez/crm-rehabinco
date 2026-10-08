import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mensajeGuardado } from "./mensaje-guardado";

describe("mensajeGuardado", () => {
  it("no avisa si la fila volvió", () => {
    assert.equal(mensajeGuardado(null, "No se ha podido guardar.", { id: "1" }), null);
  });

  it("avisa si el update no tocó ninguna fila", () => {
    assert.equal(mensajeGuardado(null, "No se ha podido guardar.", null), "No se ha podido guardar.");
  });

  it("añade el mensaje de Postgres", () => {
    assert.equal(
      mensajeGuardado({ message: "record new has no field" }, "No se ha podido crear la demanda.", null),
      "No se ha podido crear la demanda. record new has no field"
    );
  });
});
