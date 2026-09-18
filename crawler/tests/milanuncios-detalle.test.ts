import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/milanuncios/index.js";
import { milanunciosAdapter } from "../src/adapters/milanuncios/adapter.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/milanuncios");
const FIXTURE = readFileSync(path.join(FIX, "detalle-605931425.html"), "utf8");

describe("milanuncios detalle contrato", () => {
  it("parseDetail extrae teléfono E.164 desde __INITIAL_PROPS__ (sin petición extra)", () => {
    expect(milanunciosAdapter.parseDetail).toBeDefined();
    const extra = milanunciosAdapter.parseDetail!({ body: FIXTURE, url: "https://www.milanuncios.com/" });
    expect(extra.contacto_telefono).toBe("+34616046375");
    expect(extra.superficie).toBe(75);
    expect(extra.habitaciones).toBe(3);
    expect(extra.banos).toBe(1);
    expect(extra.planta).toBe("4º");
    expect(extra.lat).toBeCloseTo(37.203, 2);
  });
});
