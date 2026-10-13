import { describe, expect, it } from "vitest";
import { estadoDeCapa, estadoDeMercado, proximaCarga, SERVICIOS_VALORADOR } from "./servicios-valorador";

describe("servicios del valorador", () => {
  it("cubre las ocho capas de GitHub Actions y el rastreo semanal", () => {
    const capas = SERVICIOS_VALORADOR.filter((s) => s.capa).map((s) => s.capa);
    expect(capas).toEqual(["osm", "gtfs", "crime", "snczi", "noise", "vulnerability", "ine_sections", "inspire"]);
    expect(SERVICIOS_VALORADOR.find((s) => s.id === "mercado")?.cadencia.tipo).toBe("semanal");
  });

  it("la criminalidad de octubre de 2026 es el día 15", () => {
    const crime = SERVICIOS_VALORADOR.find((s) => s.id === "crime");
    const next = proximaCarga(crime!.cadencia, new Date("2026-10-13T08:00:00Z"));
    expect(next?.toISOString()).toBe("2026-10-15T05:00:00.000Z");
  });

  it("OpenStreetMap caduca a los 4 meses y el mercado a los 10 días", () => {
    const now = Date.parse("2026-10-13T00:00:00Z");
    expect(estadoDeCapa("osm", "2026-10-01T00:00:00Z", now)).toBe("ok");
    expect(estadoDeCapa("osm", "2026-01-01T00:00:00Z", now)).toBe("stale");
    expect(estadoDeCapa("osm", null, now)).toBe("missing");
    expect(estadoDeMercado("2026-10-12T01:00:00Z", now)).toBe("ok");
    expect(estadoDeMercado("2026-09-01T01:00:00Z", now)).toBe("stale");
  });
});
