import { describe, expect, it } from "vitest";
import { buildEnvironment } from "../environment";
import { bandaPoblacion, etiquetaCriminalidad, fmtPeriodoCriminalidad, tasaPorMil } from "../crime-rate";
import { ENV_CATEGORIES, ENV_ICONS, iconoEntorno } from "../ui/icons";

describe("tasa de criminalidad", () => {
  it("calcula infracciones × 1.000 / población y descarta lo que sale de 0–200", () => {
    expect(tasaPorMil(12150, 247604)).toBeCloseTo(49.07, 1);
    expect(tasaPorMil(1, 1)).toBeNull();
    expect(bandaPoblacion(247604)).toBe("200.000–500.000");
    expect(fmtPeriodoCriminalidad("2026T2")).toBe("2T 2026");
    expect(etiquetaCriminalidad({
      rate: 49.037,
      peer: 45.05,
      peerBand: "200.000–500.000",
      period: "2026T2",
    })).toBe(
      "Criminalidad municipal: 49,0 infracciones por 1.000 hab. · media de ciudades de 200.000–500.000 hab.: 45,1 · Ministerio del Interior, 2T 2026",
    );
  });

  it("no muestra una tasa fuera de rango", () => {
    const env = buildEnvironment({
      nearest: [{
        layer: "crime_municipality",
        category: null,
        sense: "info",
        name: null,
        props: { rate_per_1000: 4903.7, peer_avg: 45, period: "2025" },
        distance_m: 0,
      }],
      counts_500m: {},
    });
    expect(env.flags).toHaveLength(0);
  });
});

describe("iconos de entorno", () => {
  it("cubre todas las categorías y colegio y salud no caen en comercio", () => {
    for (const categoria of ENV_CATEGORIES) {
      expect(ENV_ICONS[categoria]).toBeTruthy();
    }
    expect(iconoEntorno("school:kindergarten")).toBe(ENV_ICONS.kindergarten);
    expect(iconoEntorno("health:health_center")).toBe(ENV_ICONS.health_center);
    expect(iconoEntorno("school")).toBe(ENV_ICONS.school);
    expect(iconoEntorno("health")).toBe(ENV_ICONS.health);
  });
});
