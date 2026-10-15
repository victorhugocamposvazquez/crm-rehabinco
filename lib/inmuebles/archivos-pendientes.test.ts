import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claveArchivo, fusionarArchivos, reordenarIndice, validarArchivosEntrada } from "./archivos-pendientes";

describe("archivos pendientes inmueble", () => {
  it("fusiona sin duplicar el mismo archivo", () => {
    const a = new File(["a"], "a.jpg", { type: "image/jpeg" });
    const b = new File(["b"], "b.jpg", { type: "image/jpeg" });
    assert.deepEqual(fusionarArchivos([a], [a, b]).map(claveArchivo), [claveArchivo(a), claveArchivo(b)]);
    assert.equal(fusionarArchivos([a], [a]).length, 1);
  });

  it("reordena por índice", () => {
    assert.deepEqual(reordenarIndice(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(reordenarIndice(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  });

  it("valida fotos rechazando lo que no es imagen", () => {
    const ok = new File(["x"], "f.jpg", { type: "image/jpeg" });
    const mal = new File(["x"], "f.txt", { type: "text/plain" });
    const r = validarArchivosEntrada("foto", [ok, mal]);
    assert.equal(r.ok.length, 1);
    assert.equal(r.errores.length, 1);
  });
});
