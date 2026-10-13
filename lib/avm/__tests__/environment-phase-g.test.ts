import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildEnvironment, ENV_RULES_VERSION, type RawEnvironment } from "../environment";
import { clasificarCentroDocente } from "../centros-docentes";
import { fmtNumero } from "../ui/format";
import { etiquetaMetodoAlquiler } from "../ui/labels";
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

const realPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/juan-florez-real.json");

function fixture(): RawEnvironment {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as RawEnvironment;
}

function real(): RawEnvironment {
  return JSON.parse(readFileSync(realPath, "utf8")) as RawEnvironment;
}

describe("entorno fase G", () => {
  it("Juan Flórez 30: ≥4 a favor y ≥1 en contra con nearest realista", () => {
    const env = buildEnvironment(fixture());
    expect(env.positives.length).toBeGreaterThanOrEqual(4);
    expect(env.negatives.length).toBeGreaterThanOrEqual(1);
    expect(env.score).toBeGreaterThan(40);
    expect(env.score).toBeLessThanOrEqual(100);
  });

  it("una gasolinera que no puntúa no se muestra", () => {
    const env = buildEnvironment({
      nearest: [{ layer: "osm_poi", category: "fuel", sense: "negative", name: "Repsol", props: {}, distance_m: 180 }],
      counts_500m: {},
    });
    expect(env.score).toBe(50);
    expect(env.positives).toHaveLength(0);
    expect(env.negatives).toHaveLength(0);
    expect(env.flags).toHaveLength(0);
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

  it("env-1.1 puntúa bus, supermercado, parque y colegio, y el bar no es ocio nocturno", () => {
    expect(ENV_RULES_VERSION).toBe("env-1.1");
    const env = buildEnvironment({
      nearest: [
        { layer: "gtfs_stop", category: "bus", sense: "positive", name: "Juan Flórez", props: { respaldo_gtfs: true }, distance_m: 120 },
        { layer: "osm_poi", category: "supermarket", sense: "positive", name: null, props: {}, distance_m: 180 },
        { layer: "osm_poi", category: "park", sense: "positive", name: "Méndez Núñez", props: {}, distance_m: 200 },
        { layer: "school", category: "school", sense: "positive", name: "CEIP Juan Flórez", props: { tipo: "CEIP" }, distance_m: 400 },
        { layer: "osm_poi", category: "nightlife", sense: "negative", name: "Pub X", props: { amenity: "pub" }, distance_m: 80 },
        { layer: "osm_poi", category: "hospitality", sense: "info", name: "Bar Y", props: { amenity: "bar" }, distance_m: 40 },
        { layer: "flood", category: "fuera", sense: "info", name: null, props: { clear: true, period: "fuera" }, distance_m: 0 },
        { layer: "vulnerable_section", category: null, sense: "info", name: null, props: { clear: true, census_section: "1503003003", edition: "2021" }, distance_m: 0 },
        { layer: "crime_municipality", category: null, sense: "info", name: null, props: { rate_per_1000: 49.037, peer_avg: 53.32, peer_band: "200.000–500.000", period: "2025" }, distance_m: 0 },
      ],
      counts_500m: { shop: 55 },
      counts_300m: { hospitality: 12 },
      counts_100m: { nightlife: 1 },
    });
    const indicadores = env.positives.map((p) => p.indicator);
    expect(indicadores).toEqual(expect.arrayContaining(["gtfs_stop:bus", "osm_poi:supermarket", "osm_poi:park", "school:school"]));
    expect(env.positives.find((p) => p.indicator === "osm_poi:supermarket")?.label).toBe("Supermercado");
    expect(env.positives.find((p) => p.indicator === "osm_poi:park")?.source).toBe("parque · OSM");
    expect(env.negatives.some((n) => n.indicator === "osm_poi:nightlife")).toBe(true);
    expect(JSON.stringify(env)).not.toContain("Bar Y");
    expect(env.flags.length).toBeLessThanOrEqual(3);
    expect(env.flags.map((f) => f.label)).toContain("Sección 1503003003 fuera del catálogo de áreas vulnerables · Atlas 2021");
    expect(env.score).toBeGreaterThanOrEqual(0);
    expect(env.score).toBeLessThanOrEqual(100);
  });

  it("Juan Flórez 30 con el nearest real: bus, supermercado, parque y colegio; pubs y como mucho tres banderas", () => {
    const env = buildEnvironment(real());
    const aFavor = env.positives.map((p) => p.indicator);
    expect(aFavor).toEqual(expect.arrayContaining(["gtfs_stop:bus", "osm_poi:supermarket", "osm_poi:park", "school:school"]));
    expect(env.positives.find((p) => p.indicator === "osm_poi:supermarket")?.source).toBe("supermercado · OSM");
    expect(env.positives.find((p) => p.indicator === "osm_poi:park")?.label).toBe("Praza de Recife");
    expect(env.negatives.some((n) => n.label.includes("ocio nocturno"))).toBe(true);
    expect(env.negatives.find((n) => n.indicator === "osm_poi:nightlife")?.value).toBe(-6);
    const texto = JSON.stringify(env);
    expect(texto).not.toContain("El Pinar");
    expect(texto).not.toContain("Fantini");
    expect(texto).not.toContain("Miramar");
    expect(env.flags.length).toBeLessThanOrEqual(3);
    expect(env.flags.map((f) => f.label)).toContain(
      "Sección 1503003003 fuera del catálogo de áreas vulnerables · Atlas 2021",
    );
    expect(env.flags.some((f) => f.label.startsWith("Criminalidad municipal"))).toBe(true);
  });

  it("filtra el directorio de centros y el alquiler anterior a 1.1", () => {
    expect(clasificarCentroDocente("CEIP", "CEIP San Marcos")).toBe("school");
    expect(clasificarCentroDocente("EEI", "EEI dos Ánxeles")).toBe("nursery");
    expect(clasificarCentroDocente("CPR", "CPR Ilerna")).toBeNull();
    expect(clasificarCentroDocente("CPR", "CPR Eiris")).toBe("school");
    expect(clasificarCentroDocente("EOI", "Escola oficial de idiomas")).toBeNull();
    expect(etiquetaMetodoAlquiler("comparables-1.0", null)).toBe("rentabilidad bruta de la zona (método 1.0)");
    expect(etiquetaMetodoAlquiler("comparables-1.1", "comparables")).toBe("comparables de alquiler");
    expect(fmtNumero(1030)).toBe("1.030");
    expect(fmtNumero(1150)).toBe("1.150");
  });
});
