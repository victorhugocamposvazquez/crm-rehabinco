import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  elegirSesionZona,
  hidratarSesionZona,
  permiteEscribirSesionZona,
  serializarSesionZona,
} from "./zone-archive";
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
    creada.session.callesCola = [{ code: "22", sigla: "CL", name: "MAYOR" }];
    const hidratada = hidratarSesionZona(serializarSesionZona(creada.session));
    assert.ok(hidratada);
    assert.equal(hidratada?.id, "zona-persistida");
    assert.equal(hidratada?.streetsTotal, 131);
    assert.equal(hidratada?.calles[0]?.calle.code, "11");
    assert.equal(hidratada?.callesCola?.[0]?.code, "22");
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

describe("Archivo de sesión de zona: no retroceder", () => {
  function sesionPrueba(id: string) {
    const store = createZoneStore({ idFactory: () => id });
    const creada = store.create({
      userId: "user-1",
      claveZona: "MADRID|ALCOBENDAS|28703|0",
      criterios: {
        provincia: "MADRID",
        municipio: "ALCOBENDAS",
        postalCode: "28703",
        horizontalDivision: "NO",
        streetOffset: 0,
      },
      provinciaOficial: "Madrid",
      municipioOficial: "Alcobendas",
      calles: [
        { code: "1", sigla: "CL", name: "A" },
        { code: "2", sigla: "CL", name: "B" },
      ],
      streetsTotal: 48,
      streetOffset: 0,
    });
    assert.equal(creada.ok, true);
    if (!creada.ok) throw new Error("sesión");
    return creada.session;
  }

  it("un prepare a 0 no pisa 8 calles ya hechas", () => {
    const avanzada = sesionPrueba("zona-avanzada");
    avanzada.calles[0].status = "done";
    avanzada.steps = 2;
    avanzada.updatedAt = 2_000;
    const atrasada = sesionPrueba("zona-atrasada");
    atrasada.updatedAt = 9_000;
    assert.equal(permiteEscribirSesionZona(atrasada, avanzada), false);
    assert.equal(elegirSesionZona(avanzada, atrasada), avanzada);
  });

  it("un paso con más calles sí sustituye el archivo", () => {
    const previa = sesionPrueba("zona-previa");
    previa.calles[0].status = "done";
    previa.steps = 1;
    previa.updatedAt = 1_000;
    const siguiente = sesionPrueba("zona-previa");
    siguiente.calles[0].status = "done";
    siguiente.calles[1].status = "done";
    siguiente.steps = 2;
    siguiente.updatedAt = 2_000;
    assert.equal(permiteEscribirSesionZona(siguiente, previa), true);
    assert.equal(elegirSesionZona(previa, siguiente), siguiente);
  });
});
