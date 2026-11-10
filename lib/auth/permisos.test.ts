import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hrefsConPermisos, permisoPorDefecto, rutaPermitida } from "./permisos";

describe("permisos por defecto", () => {
  it("CatastroUser entra a catastro y no ve las tareas del equipo", () => {
    assert.equal(permisoPorDefecto("catastro_user", "catastro"), true);
    assert.equal(permisoPorDefecto("catastro_user", "contactos"), true);
    assert.equal(permisoPorDefecto("catastro_user", "tareas"), true);
    assert.equal(permisoPorDefecto("catastro_user", "calendario"), true);
    assert.equal(permisoPorDefecto("catastro_user", "facturas"), false);
    assert.equal(permisoPorDefecto("catastro_user", "tareas_equipo"), false);
    assert.equal(permisoPorDefecto("comercial", "tareas_equipo"), true);
    assert.equal(rutaPermitida("/facturas", "catastro_user", null), false);
    assert.equal(rutaPermitida("/catastro/equipo", "catastro_user", null), true);
    assert.equal(rutaPermitida("/catastro/equipo", "comercial", null), false);
    assert.equal(permisoPorDefecto("admin", "usuarios"), true);
    assert.equal(permisoPorDefecto("comercial", "usuarios"), false);
    assert.equal(permisoPorDefecto("comercial", "portales"), false);
    assert.equal(rutaPermitida("/settings/roles", "admin", null), false);
    assert.equal(rutaPermitida("/settings/empresa", "comercial", null), false);
    assert.equal(rutaPermitida("/settings", "comercial", null), true);
    assert.equal(hrefsConPermisos("editor", "desktop", null).includes("/presupuestos"), true);
    assert.equal(hrefsConPermisos("editor", "desktop", null).includes("/tareas"), false);
  });
});
