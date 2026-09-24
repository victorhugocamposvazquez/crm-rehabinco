import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordsMapaAnuncio, latLngDeFila } from "./geo-mapa";

describe("geo-mapa", () => {
  it("lee lat/lng numéricos como string desde Supabase", () => {
    const { lat, lng } = latLngDeFila({ lat: "43.33", lng: "-8.31" });
    assert.equal(lat, 43.33);
    assert.equal(lng, -8.31);
  });

  it("usa centro de municipio si faltan coords", () => {
    const geo = coordsMapaAnuncio({
      id: "1",
      externo_id: "112310385",
      lat: null,
      lng: null,
      municipio: "Oleiros",
      zona: null,
    });
    assert.ok(geo?.aprox);
    assert.ok(Math.abs(geo!.lat - 43.3334) < 0.02);
  });
});
