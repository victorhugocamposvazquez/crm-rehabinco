import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/milanuncios/index.js";
import { milanunciosAdapter, totalAnunciosEnFixture } from "../src/adapters/milanuncios/adapter.js";
import type { AnuncioCrudo } from "../src/adapters/types.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/milanuncios");
const FIXTURE = readFileSync(path.join(FIX, "undici-1789646773188.html"), "utf8");

function obligatorios(a: AnuncioCrudo): void {
  expect(a.externo_id).toBeTruthy();
  expect(a.url).toMatch(/^https:\/\/www\.milanuncios\.com\//);
  expect(a.titulo).toBeTruthy();
  expect(a.precio).toBeGreaterThan(0);
}

describe("milanuncios contrato", () => {
  it("parsea listado __INITIAL_PROPS__", () => {
    const esperados = totalAnunciosEnFixture(FIXTURE);
    const { items, hayMasPaginas } = milanunciosAdapter.parseList({ body: FIXTURE, url: "" });
    expect(esperados).toBe(41);
    expect(items).toHaveLength(41);
    expect(hayMasPaginas).toBe(true);
    const conM2 = items.filter((i) => (i.superficie ?? 0) > 0);
    expect(conM2.length).toBeGreaterThan(30);
    for (const item of items) {
      obligatorios(item);
      expect(item.contacto_tipo_portal).toBe("particular");
    }
    expect(items[0].superficie).toBe(113);
    expect(items[0].habitaciones).toBe(3);
    expect(items[0].banos).toBe(2);
  });

  it("buildListUrl A Coruña particulares", () => {
    expect(
      milanunciosAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "milanuncios",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { municipio_slug: "a-coruna" },
        },
        1
      )
    ).toBe("https://www.milanuncios.com/venta-de-pisos-en-a-coruna/particulares/");
  });
});
