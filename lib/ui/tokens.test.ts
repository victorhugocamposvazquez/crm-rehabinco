import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inicialesNombre, nombreYApellido } from "./tokens";

describe("iniciales de persona", () => {
  it("usa nombre y primer apellido", () => {
    assert.equal(nombreYApellido("Iris Seoane García"), "Iris Seoane");
    assert.equal(inicialesNombre("Iris Seoane"), "IS");
    assert.equal(inicialesNombre("Iris Seoane García", "iris@rehabinco.es"), "IS");
  });

  it("un correo sin apellido no coge la inicial del dominio", () => {
    assert.equal(inicialesNombre(null, "iris@rehabinco.es"), "IR");
    assert.equal(inicialesNombre("iris@rehabinco.es"), "IR");
    assert.equal(nombreYApellido("iris@rehabinco.es"), "iris");
  });
});
