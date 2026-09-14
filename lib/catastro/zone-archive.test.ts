import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hidratarSesionZona, serializarSesionZona } from "./zone-archive";
import { createZoneStore, sesionContinuaEnSegundoPlano, snapshotContinuaEnSegundoPlano } from "./zone-session";

describe("Archivo de sesión de zona", () => {
  it("serializa y recupera calles, offset y fincas", () => {
    const store = createZoneStore({ idFactory: () => "zona-persistida" });
    const creada = store.create({
      userId: "user-1",
      claveZona: "A CORUÑA|A CORUÑA|15009|0",
      criterios: {
        provincia: "A CORUÑA",
        municipio: "A CORUÑA",
        postalCode: "15009",
        horizontalDivision: "NO",
        streetOffset: 0,
      },
      provinciaOficial: "A CORUÑA",
      municipioOficial: "A CORUÑA",
      calles: [{ code: "11", sigla: "LG", name: "AGRA MONTES" }],
      streetsTotal: 131,
      streetOffset: 0,
    });
    assert.equal(creada.ok, true);
    if (!creada.ok) return;
    creada.session.fincas.set("8801701NJ4080S", {
      fincaReference: "8801701NJ4080S",
      propertyReferences: ["8801701NJ4080S0001AA"],
      properties: [],
      portals: ["10"],
      address: { provincia: "A CORUÑA", municipio: "A CORUÑA", sigla: "LG", via: "AGRA MONTES" },
      postalCodes: ["15009"],
      horizontalDivision: { status: "NO", confidence: 1, reason: "test" },
    });
    const hidratada = hidratarSesionZona(serializarSesionZona(creada.session));
    assert.ok(hidratada);
    assert.equal(hidratada?.id, "zona-persistida");
    assert.equal(hidratada?.streetsTotal, 131);
    assert.equal(hidratada?.calles[0]?.calle.code, "11");
    assert.equal(hidratada?.fincas.get("8801701NJ4080S")?.portals[0], "10");
  });

  it("un running archivado se recupera como pausado y se puede reanudar", () => {
    const store = createZoneStore({ idFactory: () => "zona-colgada" });
    const creada = store.create({
      userId: "user-1",
      claveZona: "A CORUÑA|A CORUÑA|15009|0",
      criterios: {
        provincia: "A CORUÑA",
        municipio: "A CORUÑA",
        postalCode: "15009",
        horizontalDivision: "NO",
        streetOffset: 0,
      },
      provinciaOficial: "A CORUÑA",
      municipioOficial: "A CORUÑA",
      calles: [{ code: "11", sigla: "LG", name: "AGRA MONTES" }],
      streetsTotal: 1,
      streetOffset: 0,
    });
    assert.equal(creada.ok, true);
    if (!creada.ok) return;
    creada.session.status = "running";
    creada.session.calles[0].status = "running";
    creada.session.fincas.set("8801701NJ4080S", {
      fincaReference: "8801701NJ4080S",
      propertyReferences: ["8801701NJ4080S0001AA"],
      properties: [
        {
          reference: "8801701NJ4080S0001AA",
          unidades: [
            { uso: "residencial", tipologia: null, superficie: 80, escalera: null, planta: null, puerta: null },
          ],
        },
      ],
      portals: ["10"],
      address: { provincia: "A CORUÑA", municipio: "A CORUÑA", sigla: "LG", via: "AGRA MONTES" },
      postalCodes: ["15009"],
      horizontalDivision: { status: "NO", confidence: 1, reason: "test" },
    });
    const payload = serializarSesionZona(creada.session);
    assert.equal(payload.status, "paused");
    assert.equal(payload.calles[0]?.status, "pending");
    assert.deepEqual(payload.fincas[0]?.[1].properties[0]?.unidades, []);
    const hidratada = hidratarSesionZona({
      ...creada.session,
      status: "running",
      calles: [{ ...creada.session.calles[0], status: "running" }],
      fincas: [...creada.session.fincas.entries()],
    });
    assert.equal(hidratada?.status, "paused");
    assert.equal(hidratada?.calles[0]?.status, "pending");
  });

  it("la migración de segundo plano no toca visitas ni DH", () => {
    const sql = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations/20260914093000_catastro_zone_background.sql"),
      "utf8"
    );
    assert.match(sql, /claimed_until/);
    assert.doesNotMatch(sql, /partes_visita|\bdh_status\b/);
  });

  it("una zona empezada sigue en segundo plano; un prepare sin Empezar no", () => {
    const store = createZoneStore({ idFactory: () => "zona-fondo" });
    const creada = store.create({
      userId: "user-1",
      claveZona: "A CORUÑA|A CORUÑA|15009|0",
      criterios: {
        provincia: "A CORUÑA",
        municipio: "A CORUÑA",
        postalCode: "15009",
        horizontalDivision: "NO",
        streetOffset: 0,
      },
      provinciaOficial: "A CORUÑA",
      municipioOficial: "A CORUÑA",
      calles: [{ code: "11", sigla: "LG", name: "AGRA MONTES" }],
      streetsTotal: 1,
      streetOffset: 0,
    });
    assert.equal(creada.ok, true);
    if (!creada.ok) return;
    assert.equal(sesionContinuaEnSegundoPlano(creada.session), false);
    creada.session.status = "paused";
    creada.session.steps = 3;
    assert.equal(sesionContinuaEnSegundoPlano(creada.session), true);
    creada.session.cancelRequested = true;
    assert.equal(sesionContinuaEnSegundoPlano(creada.session), false);
    assert.equal(
      snapshotContinuaEnSegundoPlano({ status: "paused", progress: { streetsPending: 20, steps: 4 } }),
      true
    );
    assert.equal(
      snapshotContinuaEnSegundoPlano({ status: "prepared", progress: { streetsPending: 20, steps: 0 } }),
      false
    );
  });
});
