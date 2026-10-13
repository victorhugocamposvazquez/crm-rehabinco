import { describe, expect, it } from "vitest";
import { buildEnvironment } from "../environment";
import { mergeEnvironmentInforme } from "../environment-hydrate";
import { environmentFromAvmRpc } from "../environment-from-rpc";

describe("hydrate entorno informe", () => {
  it("Juan Flórez: solo criminalidad RPC → bandera informativa", () => {
    const fresh = environmentFromAvmRpc({
      nearest: [
        {
          layer: "crime_municipality",
          category: null,
          sense: "info",
          name: null,
          props: { rate_per_1000: 49.037, peer_avg: 45.05, period: "2025" },
          distance_m: 0,
        },
      ],
      counts_500m: {},
      meta: { has_osm: false },
    });
    expect(fresh?.flags.some((f) => f.label.includes("Criminalidad del municipio"))).toBe(true);
    expect(fresh?.flags.some((f) => /un poco por encima/.test(f.label) && /45,1/.test(f.label))).toBe(true);
    expect(fresh?.flags[0]?.distanceM).toBeUndefined();

    const merged = mergeEnvironmentInforme(null, fresh);
    expect(merged?.flags.length).toBe(1);
  });

  it("snapshot null con RPC crime no pierde flags al fusionar", () => {
    const fresh = buildEnvironment({
      nearest: [
        {
          layer: "crime_municipality",
          category: null,
          sense: "info",
          name: null,
          props: { rate_per_1000: 40, peer_avg: 45 },
          distance_m: 0,
        },
      ],
      counts_500m: {},
    });
    const merged = mergeEnvironmentInforme(
      { score: 55, positives: [{ indicator: "x", label: "old", sense: "positive", source: "OSM" }], negatives: [], flags: [] },
      fresh,
    );
    expect(merged?.flags.length).toBe(1);
    expect(merged?.positives.length).toBe(1);
  });
});
