import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aliasMencion, candidatosMencion, extraerMenciones, insertarMencion, partesConMenciones } from "./menciones";

const equipo = [
  { id: "ml", nombre: "Marta López", color: "#0B7461" },
  { id: "jr", nombre: "Jorge Rey", color: "#B98A16" },
];

describe("menciones en comentarios de tareas", () => {
  it("detecta @nombre y completa al elegir del listado", () => {
    assert.equal(aliasMencion("Marta López"), "Marta");
    assert.equal(extraerMenciones("Mira esto @Marta y @Jorge", equipo).map((p) => p.id).join(","), "ml,jr");
    const cand = candidatosMencion("Hola @Ma", 8, equipo);
    assert.equal(cand?.items[0]?.id, "ml");
    const insertado = insertarMencion("Hola @Ma", cand?.start ?? 0, 8, "Marta López");
    assert.equal(insertado.texto, "Hola @Marta ");
    const partes = partesConMenciones("Hola @Marta revisa", equipo);
    assert.equal(partes.some((p) => p.mencion?.id === "ml"), true);
  });
});
