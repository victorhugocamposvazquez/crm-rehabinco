import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comercialHomePath,
  isAdmin,
  isAdminBlockedPath,
  isComercial,
  isComercialBlockedPath,
  isEditorBlockedPath,
  isSuperAdmin,
  navHrefsForRole,
  parseRole,
  puedeAsignarFincas,
  puedeCrearPropiedad,
  puedeGestionarUsuarios,
  puedeRastrearCatastro,
  puedeVerApisPortales,
} from "./roles";

describe("roles", () => {
  it("normaliza agente a comercial y no inventa admin", () => {
    assert.equal(parseRole("superadmin"), "superadmin");
    assert.equal(parseRole("admin"), "admin");
    assert.equal(parseRole("editor"), "editor");
    assert.equal(parseRole("comercial"), "comercial");
    assert.equal(parseRole("agente"), "comercial");
    assert.equal(parseRole("otro"), "comercial");
    assert.equal(parseRole(undefined), "comercial");
  });

  it("el superadmin tiene todo; el admin no gestiona usuarios ni ve APIs", () => {
    assert.equal(isSuperAdmin("superadmin"), true);
    assert.equal(isSuperAdmin("admin"), false);
    assert.equal(isAdmin("superadmin"), true);
    assert.equal(isAdmin("admin"), true);
    assert.equal(puedeVerApisPortales("superadmin"), true);
    assert.equal(puedeVerApisPortales("admin"), false);
    assert.equal(puedeGestionarUsuarios("superadmin"), true);
    assert.equal(puedeGestionarUsuarios("admin"), false);
    assert.equal(isAdminBlockedPath("/settings/portales"), true);
    assert.equal(isAdminBlockedPath("/settings"), false);
  });

  it("el comercial trabaja fincas asignadas; no rastrea ni asigna", () => {
    assert.equal(isAdmin("admin"), true);
    assert.equal(isComercial("comercial"), true);
    assert.equal(puedeCrearPropiedad("comercial"), true);
    assert.equal(puedeCrearPropiedad("editor"), false);
    assert.equal(puedeRastrearCatastro("admin"), true);
    assert.equal(puedeRastrearCatastro("superadmin"), true);
    assert.equal(puedeRastrearCatastro("comercial"), false);
    assert.equal(puedeAsignarFincas("admin"), true);
    assert.equal(puedeAsignarFincas("superadmin"), true);
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
    assert.equal(comercial.includes("/herramientas"), true);
    assert.equal(comercial.includes("/partes-visita"), false);
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
    assert.deepEqual([...navHrefsForRole("superadmin", "desktop")], [...navHrefsForRole("admin", "desktop")]);
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
      "/catastro",
      "/calendario",
      "/settings",
    ]);
  });

  it("el editor no entra a captación, agenda ni tareas", () => {
    assert.equal(isEditorBlockedPath("/captacion"), true);
    assert.equal(isEditorBlockedPath("/seguimiento"), true);
    assert.equal(isEditorBlockedPath("/calendario"), true);
    assert.equal(isEditorBlockedPath("/partes-visita"), true);
    assert.equal(isEditorBlockedPath("/herramientas"), true);
    assert.equal(isEditorBlockedPath("/contratos-arras"), true);
    assert.equal(isEditorBlockedPath("/settings/portales"), true);
    assert.equal(isEditorBlockedPath("/presupuestos"), false);
  });
});
