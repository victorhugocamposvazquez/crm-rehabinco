import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consultaGoogleMaps, crearGoogleMapsUrl } from "./maps";

const GODELLETA = {
  address: {
    provincia: "VALENCIA",
    municipio: "GODELLETA",
    sigla: "CL",
    via: "GUAYANA-MOJONERA",
    numero: "3",
    literal: "CL GUAYANA-MOJONERA 3 GODELLETA (VALENCIA)",
  },
  postalCode: "46388",
  postalCodes: ["46388"],
};

describe("crearGoogleMapsUrl", () => {
  it("deriva la URL solo de la dirección oficial, sin geocodificar", () => {
    const consulta = consultaGoogleMaps(GODELLETA);
    assert.equal(consulta, "CL GUAYANA-MOJONERA 3, 46388 GODELLETA VALENCIA");
    const url = crearGoogleMapsUrl(GODELLETA);
    assert.ok(url);
    assert.equal(url.startsWith("https://www.google.com/maps/search/?api=1&query="), true);
    assert.equal(url.includes(encodeURIComponent(consulta!)), true);
    assert.equal(url.includes("geocode"), false);
    assert.equal("lat" in GODELLETA.address, false);
  });

  it("ignora numero2 oficial 0", () => {
    const consulta = consultaGoogleMaps({
      address: {
        sigla: "CL",
        via: "FUENCARRAL",
        numero: "13",
        numero2: "0",
        municipio: "MADRID",
        provincia: "MADRID",
      },
      postalCode: "28004",
    });
    assert.equal(consulta, "CL FUENCARRAL 13, 28004 MADRID MADRID");
  });

  it("si no hay vía usa el literal oficial", () => {
    const consulta = consultaGoogleMaps({
      address: {
        literal: "CL FUENCARRAL 50 MADRID (MADRID)",
        municipio: "MADRID",
        provincia: "MADRID",
      },
    });
    assert.equal(consulta, "CL FUENCARRAL 50 MADRID (MADRID), MADRID MADRID");
  });

  it("sin dirección oficial no inventa una URL", () => {
    assert.equal(crearGoogleMapsUrl({ address: {} }), null);
  });
});
