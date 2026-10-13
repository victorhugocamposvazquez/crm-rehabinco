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
          props: { rate_per_1000: 49.037, peer_avg: 45.05, peer_band: "200.000–500.000", period: "2025" },
          distance_m: 0,
        },
      ],
      counts_500m: {},
      meta: { has_osm: false },
    });
    expect(fresh?.flags[0]?.label).toBe(
      "Criminalidad municipal: 49,0 infracciones por 1.000 hab. · media de ciudades de 200.000–500.000 hab.: 45,1 · Ministerio del Interior, 2025",
    );
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
