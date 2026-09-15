import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comercialHomePath,
  isAdmin,
  isComercial,
  isComercialBlockedPath,
  isEditorBlockedPath,
  navHrefsForRole,
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
    assert.equal(isComercialBlockedPath("/catastro/equipo"), true);
    assert.equal(isComercialBlockedPath("/catastro/cobertura"), true);
    assert.equal(isComercialBlockedPath("/catastro"), false);
    assert.equal(isComercialBlockedPath("/catastro/finca/12345678901234"), false);
    assert.equal(isComercialBlockedPath("/facturas"), true);
    assert.equal(isComercialBlockedPath("/informes"), true);
    assert.equal(isComercialBlockedPath("/presupuestos"), true);
    assert.equal(isComercialBlockedPath("/settings/portales"), true);
    assert.equal(comercialHomePath(), "/");
  });

  it("el menú del comercial es el día a día, no el de dirección", () => {
    const comercial = navHrefsForRole("comercial", "desktop");
    const admin = navHrefsForRole("admin", "desktop");
    assert.equal(comercial.includes("/captacion"), true);
    assert.equal(comercial.includes("/tareas"), true);
    assert.equal(comercial.includes("/calendario"), true);
    assert.equal(comercial.includes("/partes-visita"), true);
    assert.equal(comercial.includes("/facturas"), false);
    assert.equal(comercial.includes("/informes"), false);
    assert.equal(comercial.includes("/presupuestos"), false);
    assert.equal(admin.includes("/facturas"), true);
    assert.deepEqual([...navHrefsForRole("admin", "top")], [
      "/",
      "/captacion",
      "/catastro",
      "/propiedades",
      "/demandas",
    ]);
    assert.equal(navHrefsForRole("admin", "top").includes("/clientes"), false);
    assert.equal(navHrefsForRole("admin", "desktop").includes("/clientes"), true);
    assert.equal(navHrefsForRole("admin", "desktop").includes("/facturas"), true);
    assert.deepEqual([...navHrefsForRole("comercial", "mobile")], [
      "/",
      "/propiedades",
      "/calendario",
      "/tareas",
      "/settings",
    ]);
    assert.deepEqual([...navHrefsForRole("admin", "mobile")], [
      "/",
      "/propiedades",
      "/calendario",
      "/tareas",
      "/settings",
    ]);
  });

  it("el editor no entra a captación, agenda ni tareas", () => {
    assert.equal(isEditorBlockedPath("/captacion"), true);
    assert.equal(isEditorBlockedPath("/seguimiento"), true);
    assert.equal(isEditorBlockedPath("/calendario"), true);
    assert.equal(isEditorBlockedPath("/partes-visita"), true);
    assert.equal(isEditorBlockedPath("/settings/portales"), true);
    assert.equal(isEditorBlockedPath("/presupuestos"), false);
  });
});
