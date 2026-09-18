import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/pisos/index.js";
import { pisosAdapter, totalAnunciosEnFixture } from "../src/adapters/pisos/adapter.js";
import type { AnuncioCrudo } from "../src/adapters/types.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/pisos");
const FIXTURE = readFileSync(path.join(FIX, "undici-1789646703718.html"), "utf8");

function obligatorios(a: AnuncioCrudo): void {
  expect(a.externo_id).toBeTruthy();
  expect(a.url).toMatch(/^https:\/\/www\.pisos\.com\//);
  expect(a.titulo).toBeTruthy();
  expect(a.precio).toBeGreaterThan(0);
  expect(a.municipio).toBeTruthy();
}

describe("pisos.com contrato", () => {
  it("parsea listado JSON-LD + HTML", () => {
    const esperados = totalAnunciosEnFixture(FIXTURE);
    const { items } = pisosAdapter.parseList({
      body: FIXTURE,
      url: "https://www.pisos.com/venta/piso-girona_capital/particulares/",
    });
    expect(esperados).toBe(31);
    expect(items).toHaveLength(31);
    for (const item of items) {
      obligatorios(item);
      expect(item.anunciante).toBe("particular");
    }
  });

  it("buildListUrl A Coruña particulares", () => {
    expect(
      pisosAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "pisos.com",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { municipio_slug: "a_coruna", tipo_slug: "piso" },
        },
        2
      )
    ).toBe("https://www.pisos.com/venta/piso-a_coruna/particulares/2/");
  });
});
