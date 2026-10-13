import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEnvironment, type RawEnvironment } from "../environment";
import { valuate } from "../valuate";
import { emptyTwin } from "../types";

const juanFlorez = () => ({
  ...emptyTwin(),
  address: {
    ...emptyTwin().address,
    formattedAddress: "Rúa Juan Flórez 30, 15004 A Coruña",
    postcode: "15004",
    locality: "A Coruña",
    municipalityCode: "15030",
    lat: 43.3654271,
    lng: -8.408791,
  },
  mainType: "apartment" as const,
  propertyType: "apartment" as const,
  builtSurface: 95,
});

const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/juan-florez-environment.json");

function fixture(): RawEnvironment {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as RawEnvironment;
}

describe("entorno fase G", () => {
  it("Juan Flórez 30: ≥4 a favor y ≥1 en contra con nearest realista", () => {
    const env = buildEnvironment(fixture());
    expect(env.positives.length).toBeGreaterThanOrEqual(4);
    expect(env.negatives.length).toBeGreaterThanOrEqual(1);
    expect(env.score).toBeGreaterThan(40);
    expect(env.score).toBeLessThanOrEqual(100);
  });

  it("gasolinera a 180 m sale en avisos aunque no reste puntos", () => {
    const env = buildEnvironment({
      nearest: [{ layer: "osm_poi", category: "fuel", sense: "negative", name: "Repsol", props: {}, distance_m: 180 }],
      counts_500m: {},
    });
    expect(env.negatives.some((n) => n.label.includes("Gasolinera"))).toBe(false);
    expect(env.flags.some((f) => f.label.includes("Gasolinera") && f.distanceM === 180)).toBe(true);
  });

  it("punto en polígono T500 devuelve bandera de inundación", () => {
    const env = buildEnvironment({
      nearest: [{ layer: "flood", category: "T500", sense: "negative", name: null, props: { period: "T500" }, distance_m: 0 }],
      counts_500m: {},
    });
    expect(env.flags.some((f) => f.label.includes("T500"))).toBe(true);
  });

  it("sin capa OSM el dep devuelve null y la valoración sigue", async () => {
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => null,
      comparables: async () => [],
      environment: async () => null,
    }, { channel: "crm", propertySource: "manual", geocodingSource: "google" });
    expect(r.environment).toBeNull();
    expect(r.sourcesUsed.find((s) => s.layer === "environment")?.status).toBe("missing");
    expect(r.valueMid).toBeGreaterThan(0);
  });

  it("con entorno cargado la fuente pasa a primary", async () => {
    const env = buildEnvironment(fixture());
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => null,
      comparables: async () => [],
      environment: async () => env,
    }, { channel: "crm", propertySource: "manual", geocodingSource: "google" });
    expect(r.environment?.positives.length).toBeGreaterThanOrEqual(4);
    expect(r.sourcesUsed.find((s) => s.layer === "environment")?.status).toBe("primary");
  });
});
