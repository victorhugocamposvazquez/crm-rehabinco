import { describe, expect, it } from "vitest";
import { avisoEntornoVacio } from "../entorno-coverage";

describe("avisoEntornoVacio", () => {
  it("sin capas en municipio", () => {
    const aviso = avisoEntornoVacio(null, { municipality_has_layers: false, elements_within_600m: 0, layers_consulted: [] }, "A Coruña");
    expect(aviso?.kind).toBe("sin_capas");
  });

  it("capas cargadas pero nada a 600 m", () => {
    const aviso = avisoEntornoVacio(
      { score: 50, positives: [], negatives: [], flags: [] },
      {
        municipality_has_layers: true,
        elements_within_600m: 0,
        layers_consulted: [{ layer: "osm_poi", source: "OSM", loaded_at: "2026-01-01T00:00:00Z" }],
      },
      "A Coruña",
    );
    expect(aviso?.kind).toBe("sin_cerca");
  });

  it("con positivos no avisa", () => {
    const aviso = avisoEntornoVacio(
      {
        score: 60,
        positives: [{ indicator: "osm_poi", label: "x", sense: "positive", source: "OSM" }],
        negatives: [],
        flags: [],
      },
      { municipality_has_layers: true, elements_within_600m: 0, layers_consulted: [] },
      "A Coruña",
    );
    expect(aviso).toBeNull();
  });
});
