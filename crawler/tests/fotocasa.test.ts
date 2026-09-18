import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/fotocasa/index.js";
import { fotocasaAdapter, totalAnunciosEnFixture } from "../src/adapters/fotocasa/adapter.js";
import type { AnuncioCrudo } from "../src/adapters/types.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/fotocasa");
const FIXTURE = readFileSync(path.join(FIX, "undici-1789646835844.html"), "utf8");

function obligatorios(a: AnuncioCrudo): void {
  expect(a.externo_id).toBeTruthy();
  expect(a.url).toMatch(/^https:\/\/www\.fotocasa\.es\//);
  expect(a.titulo).toBeTruthy();
  expect(a.precio).toBeGreaterThan(0);
  expect(a.municipio).toBeTruthy();
}

describe("fotocasa contrato", () => {
  it("parsea listado __initial_props__", () => {
    const esperados = totalAnunciosEnFixture(FIXTURE);
    const { items, hayMasPaginas } = fotocasaAdapter.parseList({ body: FIXTURE, url: "" });
    expect(esperados).toBe(31);
    expect(items).toHaveLength(31);
    expect(hayMasPaginas).toBe(true);
    for (const item of items) {
      obligatorios(item);
      expect(item.contacto_telefono).toMatch(/^\+/);
      expect(item.contacto_tipo_portal).toBe("particular");
    }
  });

  it("buildListUrl A Coruña provincia", () => {
    expect(
      fotocasaAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "fotocasa",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { provincia_slug: "a-coruna" },
        },
        1
      )
    ).toBe("https://www.fotocasa.es/es/comprar/viviendas/a-coruna/todas-las-zonas/l?filter=particulares");
  });
});
