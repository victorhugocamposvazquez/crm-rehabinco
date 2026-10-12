import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { distanciaMetros } from "./crawl/cluster";
import {
  buildTwin,
  conCache,
  condicionDesdePista,
  type CatastroHit,
  type FichaOrigen,
  type GeoHit,
  type TwinDeps,
} from "./twin-builder";

const ctx = { tenantId: "00000000-0000-4000-8000-000000000001" };
const punto: GeoHit = { lat: 43.37, lng: -8.41, postcode: "15004", locality: "A Coruña" };

function deps(parcial: Partial<TwinDeps> = {}): TwinDeps {
  const vacio = async () => {
    throw new Error("no debería llamarse");
  };
  return {
    geocodeGoogle: vacio,
    geocodeCartociudad: vacio,
    postcodeCentroid: vacio,
    postcodeAt: async () => null,
    zoneAt: async () => ({ censusSection: "1503001012", municipalityCode: "15030" }),
    catastroLocal: async () => null,
    catastroSede: async () => ({ hit: null }),
    listingById: async () => null,
    crmById: async () => null,
    ...parcial,
  };
}

function sede(hit: Partial<CatastroHit>): CatastroHit {
  return {
    parcelRef: "8018007NJ4081N",
    units: [],
    builtSurface: null,
    landSurface: null,
    constructionYear: null,
    floorOfFlat: null,
    numberOfFloors: null,
    mainType: null,
    propertyType: null,
    ...hit,
  };
}

describe("buildTwin", () => {
  it("geocodifica con CartoCiudad y deja Google para cuando esa no responde", async () => {
    const out = await buildTwin(
      { address: "Rúa Juan Flórez 30, 15004 A Coruña" },
      ctx,
      deps({ geocodeCartociudad: async () => punto })
    );
    expect(out.geocodingSource).toBe("cartociudad");
    expect(out.twin.address.lat).toBe(43.37);
    expect(out.zone.municipalityCode).toBe("15030");
    expect(out.zone.postcode).toBe("15004");
  });

  it("si CartoCiudad falla sigue con Google", async () => {
    const out = await buildTwin(
      { address: "Rúa Juan Flórez 30, 15004 A Coruña" },
      ctx,
      deps({
        geocodeCartociudad: async () => {
          throw new Error("timeout");
        },
        geocodeGoogle: async () => punto,
      })
    );
    expect(out.geocodingSource).toBe("google");
    expect(out.warnings.some((w) => w.startsWith("CartoCiudad:"))).toBe(true);
  });

  it("si fallan los dos geocoders usa el código postal cacheado", async () => {
    const out = await buildTwin(
      { address: "Calle Falsa 1, 15004 A Coruña" },
      ctx,
      deps({
        geocodeGoogle: async () => null,
        geocodeCartociudad: async () => null,
        postcodeCentroid: async () => ({ lat: 43.365, lng: -8.41, postcode: "15004" }),
      })
    );
    expect(out.geocodingSource).toBe("postcode_centroid");
    expect(out.twin.address.lat).toBe(43.365);
  });

  it("sin ninguna coordenada devuelve missing y no lanza", async () => {
    const out = await buildTwin(
      { address: "Calle que no existe" },
      ctx,
      deps({
        geocodeGoogle: async () => null,
        geocodeCartociudad: async () => null,
        postcodeCentroid: async () => null,
        zoneAt: async () => {
          throw new Error("no hay punto");
        },
      })
    );
    expect(out.geocodingSource).toBe("missing");
    expect(out.twin.address.lat).toBeNull();
    expect(out.twin.address.formattedAddress).toBe("Calle que no existe");
    expect(out.propertySource).toBe("manual");
    expect(out.warnings.some((w) => w.includes("marcar el punto"))).toBe(true);
  });

  it("un timeout de la Sede devuelve la caché caducada y lo avisa", async () => {
    const leido = await conCache({
      ttlMs: 1000,
      now: Date.parse("2026-10-12T00:00:00Z"),
      read: async () => ({
        payload: sede({ builtSurface: 88, constructionYear: 1967 }),
        fetchedAt: "2026-01-01T00:00:00.000Z",
      }),
      write: async () => {
        throw new Error("no escribe");
      },
      fetchFresh: async () => {
        throw new Error("timeout");
      },
    });
    expect(leido.stale).toBe(true);
    expect(leido.value?.builtSurface).toBe(88);
    expect(leido.warning).toMatch(/caché/);

    const out = await buildTwin(
      { address: "Calle Mayor 1, 15004 A Coruña", lat: 43.37, lng: -8.41 },
      ctx,
      deps({
        catastroSede: async () => ({
          hit: sede({ builtSurface: 88, constructionYear: 1967 }),
          warning: leido.warning ?? undefined,
        }),
      })
    );
    expect(out.twin.builtSurface).toBe(88);
    expect(out.geocodingSource).toBe("pin");
    expect(out.warnings.some((w) => w.includes("caché"))).toBe(true);
    expect(out.fieldSources.builtSurface).toBe("catastro_sede");
    expect(out.prefilledFields.has("builtSurface")).toBe(true);
  });

  it("una parcela con 12 unidades no rellena la superficie", async () => {
    const units = Array.from({ length: 12 }, (_, i) => ({
      catastralRef: `8018007NJ4081N${String(i + 1).padStart(4, "0")}TR`,
      floor: String(i % 4).padStart(2, "0"),
      door: "A",
      surface: 70 + i,
      use: "Vivienda",
      isDwelling: true,
    }));
    const out = await buildTwin(
      { address: "Rúa Juan Flórez 30, 15004 A Coruña", lat: 43.3656, lng: -8.4085 },
      ctx,
      deps({
        catastroSede: async () => ({
          hit: sede({ units, constructionYear: 1967, numberOfFloors: 4, builtSurface: 999 }),
        }),
      })
    );
    expect(out.units).toHaveLength(12);
    expect(out.twin.builtSurface).toBeNull();
    expect(out.twin.floorOfFlat).toBeNull();
    expect(out.twin.constructionYear).toBe(1967);
    expect(out.prefilledFields.has("constructionYear")).toBe(true);
    expect(out.prefilledFields.has("builtSurface")).toBe(false);
  });

  it("traduce condition_hint a buildingCondition", () => {
    expect(condicionDesdePista("a estrenar")).toBe(5);
    expect(condicionDesdePista("obra nueva")).toBe(5);
    expect(condicionDesdePista("reformado")).toBe(4);
    expect(condicionDesdePista("buen estado")).toBe(3);
    expect(condicionDesdePista("a actualizar")).toBe(2);
    expect(condicionDesdePista("a reformar")).toBe(1);
    expect(condicionDesdePista(null)).toBeNull();
    expect(condicionDesdePista("")).toBeNull();
  });

  it("Catastro gana la superficie y el anuncio gana el ascensor", async () => {
    const anuncio: FichaOrigen = {
      source: "listing",
      builtSurface: 80,
      hasElevator: true,
      conditionHint: "buen estado",
      price: 250000,
      rooms: 3,
    };
    const out = await buildTwin(
      { listingId: "anuncio-1", lat: 43.37, lng: -8.41 },
      ctx,
      deps({
        listingById: async () => anuncio,
        catastroSede: async () => ({ hit: sede({ builtSurface: 95, constructionYear: 1972 }) }),
      })
    );
    expect(out.twin.builtSurface).toBe(95);
    expect(out.fieldSources.builtSurface).toBe("catastro_sede");
    expect(out.twin.hasElevator).toBe(true);
    expect(out.fieldSources.hasElevator).toBe("listing");
    expect(out.twin.buildingCondition).toBe(3);
    expect(out.listingPrice).toBe(250000);
    expect(out.twin.address.lat).toBe(43.37);
    expect("listingPrice" in out.twin).toBe(false);
    expect(out.geocodingSource).toBe("listing");
  });
});

function cargarEnv(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  for (const rel of [".env.local", "crawler/.env"]) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      const value = m[2].replace(/^"|"$/g, "");
      if (value) process.env[m[1]] = value;
    }
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
  }
}

async function hayRed(): Promise<boolean> {
  try {
    const res = await fetch("https://www.cartociudad.es/geocoder/api/geocoder/find?q=15004", {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe("buildTwin Juan Flórez", () => {
  it("resuelve la dirección real cuando hay red", async ({ skip }) => {
    if (!(await hayRed())) {
      skip();
      return;
    }
    cargarEnv();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      skip();
      return;
    }
    const out = await buildTwin(
      { address: "Rúa Juan Flórez 30, 15004 A Coruña" },
      ctx
    );
    expect(out.twin.address.lat).not.toBeNull();
    expect(out.twin.address.lng).not.toBeNull();
    expect(
      distanciaMetros(out.twin.address.lat!, out.twin.address.lng!, 43.3654, -8.4088)
    ).toBeLessThan(50);
    expect(out.zone.postcode).toBe("15004");
    expect(out.zone.municipalityCode).toBe("15030");
    expect(out.geocodingSource).toBe("catastro");
    expect(out.twin.address.catastralRef?.slice(0, 14)).toBe("8018007NJ4081N");
    expect(out.units && out.units.length > 1).toBe(true);
    const unidad = out.units?.find((u) => u.floor === "03" && u.door === "DR" && u.isDwelling);
    expect(unidad?.catastralRef).toHaveLength(20);
    const elegido = await buildTwin(
      { address: "Rúa Juan Flórez 30, 15004 A Coruña", catastralRef: unidad?.catastralRef },
      ctx
    );
    expect(elegido.twin.mainType).toBe("apartment");
    expect(elegido.twin.propertyType).toBe("apartment");
    expect(elegido.twin.builtSurface).toBeGreaterThan(0);
    expect(elegido.twin.floorOfFlat).toBe(3);
    expect(elegido.fieldSources.builtSurface).toBe("catastro_sede");
    expect(elegido.fieldSources.floorOfFlat).toBe("catastro_sede");
    expect(elegido.twin.address.catastralRef).toHaveLength(20);
    expect(elegido.prefilledFields.has("floorOfFlat")).toBe(true);
  }, 45000);
});
