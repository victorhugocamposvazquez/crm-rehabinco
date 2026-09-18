import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/wallapop/index.js";
import { totalAnunciosEnFixture, wallapopAdapter } from "../src/adapters/wallapop/adapter.js";
import type { AnuncioCrudo } from "../src/adapters/types.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/wallapop");
const FIXTURE = readFileSync(path.join(FIX, "search.json"), "utf8");

function obligatorios(a: AnuncioCrudo): void {
  expect(a.externo_id).toBeTruthy();
  expect(a.url).toMatch(/^https:\/\/es\.wallapop\.com\/item\//);
  expect(a.titulo).toBeTruthy();
  expect(a.municipio).toBeTruthy();
}

describe("wallapop contrato API", () => {
  it("parsea search.json (items en data.section.payload)", () => {
    const esperados = totalAnunciosEnFixture(FIXTURE);
    expect(esperados).toBe(40);
    const { items, hayMasPaginas } = wallapopAdapter.parseList({ body: FIXTURE, url: "https://api.wallapop.com/" });
    expect(items).toHaveLength(40);
    expect(hayMasPaginas).toBe(true);
    for (const item of items) {
      obligatorios(item);
      expect(item.contacto_tipo_portal).toBe("desconocido");
      expect(item.anunciante).toBe("desconocido");
    }
  });

  it("buildListUrl usa lat/lng/radio y paginación start", () => {
    expect(
      wallapopAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "wallapop",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { lat: 43.3623, lng: -8.4115, radio_km: 15, category_id: 200, keywords: "piso" },
        },
        1
      )
    ).toContain("latitude=43.3623");
    expect(
      wallapopAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "wallapop",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { lat: 43.3623, lng: -8.4115, radio_km: 15 },
        },
        2
      )
    ).toContain("start=40");
  });

  it("detalleNecesario es nunca", () => {
    expect(wallapopAdapter.detalleNecesario).toBe("nunca");
  });
});
