import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comercialHomePath,
  isAdmin,
  isComercial,
  isComercialBlockedPath,
  parseRole,
  puedeAsignarFincas,
  puedeCrearPropiedad,
  puedeRastrearCatastro,
} from "./roles";

describe("roles", () => {
  it("normaliza agente a comercial y no inventa admin", () => {
    assert.equal(parseRole("admin"), "admin");
    assert.equal(parseRole("editor"), "editor");
    assert.equal(parseRole("comercial"), "comercial");
    assert.equal(parseRole("agente"), "comercial");
    assert.equal(parseRole("otro"), "comercial");
    assert.equal(parseRole(undefined), "comercial");
  });

  it("el comercial trabaja fincas asignadas; no rastrea ni asigna", () => {
    assert.equal(isAdmin("admin"), true);
    assert.equal(isComercial("comercial"), true);
    assert.equal(puedeCrearPropiedad("comercial"), true);
    assert.equal(puedeCrearPropiedad("editor"), false);
    assert.equal(puedeRastrearCatastro("admin"), true);
    assert.equal(puedeRastrearCatastro("comercial"), false);
    assert.equal(puedeAsignarFincas("admin"), true);
    assert.equal(puedeAsignarFincas("comercial"), false);
  });

  it("el comercial no entra al rastreador ni al histórico de búsquedas", () => {
    assert.equal(isComercialBlockedPath("/buscar"), true);
    assert.equal(isComercialBlockedPath("/catastro/searches"), true);
    assert.equal(isComercialBlockedPath("/catastro/searches/abc"), true);
    assert.equal(isComercialBlockedPath("/catastro"), false);
    assert.equal(isComercialBlockedPath("/catastro/finca/12345678901234"), false);
    assert.equal(comercialHomePath(), "/catastro");
  });
});
