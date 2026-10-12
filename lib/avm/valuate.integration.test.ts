import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { juanFlorez } from "./__tests__/avm.test";
import { valuate } from "./valuate";
import { depsMercado, valorar, type SolicitudValoracion } from "./valuate-service";
import type { TwinBuild, TwinUnit } from "./twin-builder";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function cargarEnv(): void {
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

function clienteLanding(landing: { tenant_id: string; active: boolean } | null) {
  const q = {
    select() { return q; },
    eq() { return q; },
    in() { return q; },
    order() { return q; },
    upsert() { return q; },
    insert() { return q; },
    maybeSingle: async () => ({ data: landing, error: null }),
    single: async () => ({ data: { id: "11111111-1111-4111-8111-111111111111" }, error: null }),
    then(resolve: (value: { data: never[]; error: null }) => void) { resolve({ data: [], error: null }); },
  };
  return {
    from() { return q; },
    rpc: async (name: string) => ({ data: name === "avm_rate_limit_hit" ? true : null, error: null }),
  };
}

describe("valuate con dependencias", () => {
  it("sin mercado ni comparables degrada y baja la confianza", async () => {
    const r = await valuate(juanFlorez(), {
      zoneStats: async () => null,
      comparables: async () => [],
    }, { channel: "crm", propertySource: "manual", geocodingSource: "postcode_centroid" });
    expect(r.valueMid).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThan(40);
    expect(r.sourcesUsed.find((s) => s.layer === "market")?.status).toBe("missing");
  });

  it("con el mercado real de Juan Flórez hay comparables cerca y confianza de fuente primaria", async ({ skip }) => {
    cargarEnv();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      skip();
      return;
    }
    try {
      const res = await fetch("https://www.cartociudad.es/geocoder/api/geocoder/find?q=15004", { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        skip();
        return;
      }
    } catch {
      skip();
      return;
    }
    const { createAdminClient } = await import("../supabase/admin");
    const r = await valuate(juanFlorez(), depsMercado(createAdminClient()), {
      channel: "crm",
      operation: "sale",
      propertySource: "catastro_live",
      geocodingSource: "catastro",
    });
    const radio = Math.max(...r.comparables.map((c) => c.radiusM));
    expect(r.comparables.length).toBeGreaterThanOrEqual(8);
    const duplicado = r.comparables.filter((c) => c.price === 270000 && c.surface === 70);
    expect(duplicado).toHaveLength(1);
    expect(radio).toBeLessThanOrEqual(1500);
    expect(r.confidence).toBeGreaterThanOrEqual(50);
    expect(r.sourcesUsed.find((s) => s.layer === "market")?.status).toBe("primary");
  });
});

describe("acceso de la valoración", () => {
  it("una landing sin slug válido responde 404", async () => {
    const respuesta = await valorar(
      { input: { address: "Calle Falsa 1" }, channel: "landing", landingSlug: "no-existe" },
      { admin: clienteLanding(null) as never }
    );
    expect(respuesta.status).toBe(404);
  });

  it("la landing no devuelve comparables ni la explicación", async () => {
    const respuesta = await valorar(
      { input: { twin: juanFlorez() }, channel: "landing", landingSlug: "rehabinco" },
      { admin: clienteLanding({ tenant_id: "00000000-0000-4000-8000-000000000001", active: true }) as never }
    );
    expect(respuesta.status).toBe(200);
    if (respuesta.status !== 200) return;
    const result = respuesta.body.result as Record<string, unknown>;
    expect(result.comparables).toBeUndefined();
    expect(result.explanation).toBeUndefined();
    expect(result.comparablesCount).toEqual(expect.any(Number));
  });

  it("una parcela con varias unidades y sin elegir responde 409", async () => {
    const units: TwinUnit[] = [
      { catastralRef: "8018007NJ4081N0001DR", floor: "00", door: "DR", surface: 90, use: "Vivienda", isDwelling: true },
      { catastralRef: "8018007NJ4081N0007LP", floor: "03", door: "DR", surface: 86, use: "Vivienda", isDwelling: true },
    ];
    const construir = async (): Promise<TwinBuild> => ({
      twin: juanFlorez(),
      prefilledFields: new Set(),
      fieldSources: {},
      propertySource: "catastro_sede",
      geocodingSource: "catastro",
      zone: { censusSection: "1503003003", municipalityCode: "15030", postcode: "15004" },
      units,
      warnings: [],
    });
    const respuesta = await valorar(
      { input: { address: "Rúa Juan Flórez 30" }, channel: "landing", landingSlug: "rehabinco" } satisfies SolicitudValoracion,
      { admin: clienteLanding({ tenant_id: "00000000-0000-4000-8000-000000000001", active: true }) as never, construir }
    );
    expect(respuesta.status).toBe(409);
    if (respuesta.status === 409) expect(respuesta.body.units).toHaveLength(2);
  });
});
