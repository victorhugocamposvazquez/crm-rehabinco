import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mensajePersonaAlta, resolverPersonaAlta, type PersonaAltaOpcion } from "./alta-persona";

const ana: PersonaAltaOpcion = { id: "1", nombre: "Ana López", telefono: "600" };
const luis: PersonaAltaOpcion = { id: "2", nombre: "Luis Pérez", telefono: null };

describe("resolverPersonaAlta", () => {
  it("si ya hay cliente, está listo", () => {
    assert.equal(resolverPersonaAlta("cli", "Ana", [ana]).tipo, "listo");
  });

  it("un único resultado se puede elegir al crear", () => {
    const paso = resolverPersonaAlta("", "Ana", [ana]);
    assert.equal(paso.tipo, "unico");
    if (paso.tipo === "unico") assert.equal(paso.persona.id, "1");
  });

  it("sin coincidencias abre el alta con ese nombre", () => {
    const paso = resolverPersonaAlta("", "Marta Novo", []);
    assert.equal(paso.tipo, "alta");
    if (paso.tipo === "alta") assert.equal(paso.nombre, "Marta Novo");
  });

  it("varios resultados pide pulsar uno", () => {
    assert.equal(resolverPersonaAlta("", "a", [ana, luis]).tipo, "varios");
    assert.match(mensajePersonaAlta({ tipo: "varios" }), /Pulsa el nombre/);
  });

  it("buscador vacío pide elegir o crear", () => {
    assert.equal(resolverPersonaAlta("", "  ", []).tipo, "vacio");
    assert.match(mensajePersonaAlta({ tipo: "vacio" }), /Elige un cliente/);
  });
});
