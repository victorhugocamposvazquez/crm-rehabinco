import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/pisos/index.js";
import { pisosAdapter } from "../src/adapters/pisos/adapter.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/pisos");
const FIXTURE = readFileSync(path.join(FIX, "detalle-62531857453_106900.html"), "utf8");

describe("pisos.com detalle contrato", () => {
  it("parseDetail extrae teléfono E.164 desde vtmExtraVars (sin petición extra)", () => {
    expect(pisosAdapter.parseDetail).toBeDefined();
    const extra = pisosAdapter.parseDetail!({ body: FIXTURE, url: "https://www.pisos.com/" });
    expect(extra.contacto_telefono).toBe("+34604054005");
  });
});
