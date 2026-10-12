import { describe, expect, it } from "vitest";
import { environmentFromAvmRpc } from "../environment-from-rpc";

describe("environmentFromAvmRpc", () => {
  it("devuelve null si no hay filas ni OSM", () => {
    expect(environmentFromAvmRpc({ nearest: [], counts_500m: {}, meta: { has_osm: false } })).toBeNull();
  });

  it("construye entorno aunque has_osm sea false si hay nearest", () => {
    const env = environmentFromAvmRpc({
      nearest: [
        {
          layer: "gtfs_stop",
          category: "bus",
          sense: "positive",
          name: "Parada",
          props: {},
          distance_m: 120,
        },
      ],
      counts_500m: {},
      meta: { has_osm: false },
    });
    expect(env?.positives.length).toBeGreaterThan(0);
  });
});
