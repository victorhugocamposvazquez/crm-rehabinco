import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanciaMetros, sugerirModalidad } from "./geo";
import type { WorkCenter } from "./types";

const merced: WorkCenter = {
  id: "merced",
  name: "Merced",
  address: "Merced 57",
  lat: 43.352787,
  lng: -8.39328,
  radius_m: 250,
};

describe("geo fichaje", () => {
  it("distancia cero en el mismo punto", () => {
    assert.ok(distanciaMetros(43.352787, -8.39328, 43.352787, -8.39328) < 1);
  });

  it("sugiere office dentro del radio", () => {
    const s = sugerirModalidad(43.352787, -8.39328, [merced]);
    assert.equal(s.mode, "office");
    assert.equal(s.workCenter?.id, "merced");
  });

  it("sugiere office si el error GPS acerca al radio", () => {
    // ~280 m del centro: fuera de 250, dentro de 250+80
    const s = sugerirModalidad(43.3553, -8.39328, [merced], null, 80);
    assert.equal(s.mode, "office");
  });

  it("sugiere remote fuera del radio", () => {
    const s = sugerirModalidad(43.4, -8.5, [merced]);
    assert.equal(s.mode, "remote");
    assert.equal(s.workCenter, null);
    assert.ok((s.distanceM ?? 0) > 1000);
  });
});
