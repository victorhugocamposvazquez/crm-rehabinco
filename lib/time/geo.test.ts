import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanciaMetros, sugerirModalidad } from "./geo";
import type { WorkCenter } from "./types";

const merced: WorkCenter = {
  id: "merced",
  name: "Merced",
  address: "Merced 57",
  lat: 43.3682,
  lng: -8.4039,
  radius_m: 150,
};

describe("geo fichaje", () => {
  it("distancia cero en el mismo punto", () => {
    assert.ok(distanciaMetros(43.3682, -8.4039, 43.3682, -8.4039) < 1);
  });

  it("sugiere office dentro del radio", () => {
    const s = sugerirModalidad(43.3682, -8.4039, [merced]);
    assert.equal(s.mode, "office");
    assert.equal(s.workCenter?.id, "merced");
  });

  it("sugiere remote fuera del radio", () => {
    const s = sugerirModalidad(43.4, -8.5, [merced]);
    assert.equal(s.mode, "remote");
    assert.equal(s.workCenter, null);
  });
});
