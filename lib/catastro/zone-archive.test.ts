import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hidratarSesionZona, serializarSesionZona } from "./zone-archive";
import { createZoneStore } from "./zone-session";

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
});
