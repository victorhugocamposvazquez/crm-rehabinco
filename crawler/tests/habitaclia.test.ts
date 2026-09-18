import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import "../src/adapters/habitaclia/index.js";
import { habitacliaAdapter, totalAnunciosEnJson } from "../src/adapters/habitaclia/adapter.js";
import type { AnuncioCrudo } from "../src/adapters/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, "fixtures/habitaclia");

function leer(nombre: string): string {
  return readFileSync(path.join(FIX, nombre), "utf8");
}

function obligatorios(a: AnuncioCrudo): void {
  expect(a.externo_id).toBeTruthy();
  expect(a.url).toMatch(/^https:\/\/www\.habitaclia\.com\//);
  expect(a.operacion).toMatch(/^(venta|alquiler)$/);
  expect(a.tipo).toBeTruthy();
  expect(a.precio).toBeGreaterThan(0);
  expect(a.superficie).toBeGreaterThan(0);
  expect(a.municipio).toBeTruthy();
  expect(a.titulo).toBeTruthy();
}

describe("habitaclia contrato", () => {
  it("parsea listado particulares Girona capital", () => {
    const html = leer("undici-1789637963665.html");
    const esperados = totalAnunciosEnJson(html);
    const { items, hayMasPaginas } = habitacliaAdapter.parseList({ body: html, url: "" });
    expect(esperados).toBe(25);
    expect(items).toHaveLength(25);
    expect(hayMasPaginas).toBe(false);
    for (const item of items) {
      obligatorios(item);
      expect(item.contacto_tipo_portal).toBe("particular");
      expect(item.anunciante).toBe("particular");
    }
  });

  it("distingue particular y profesional sin filtro", () => {
    const html = leer("undici-1789637792967.html");
    const { items } = habitacliaAdapter.parseList({ body: html, url: "" });
    expect(items.length).toBeGreaterThan(0);
    const profesionales = items.filter((i) => i.contacto_tipo_portal === "profesional");
    expect(profesionales.length).toBe(items.length);
    expect(profesionales.every((i) => i.nombre_comercial)).toBe(true);
  });

  it("parsea listado descargado del bucket crawl-raw (worker)", () => {
    const html = leer("worker-72785d913e61856f.html");
    const esperados = totalAnunciosEnJson(html);
    const { items } = habitacliaAdapter.parseList({
      body: html,
      url: "https://www.habitaclia.com/comprar/viviendas/girona-provincia/girona-capital/particulares/s",
    });
    expect(esperados).toBe(25);
    expect(items).toHaveLength(25);
    expect(items.every((i) => i.contacto_tipo_portal === "particular")).toBe(true);
  });

  it("parseDetail enriquece ficha legacy con descripción, dirección, fotos y fecha", () => {
    let html = leer("detalle-500006042448.html");
    html = html.replace(
      '<div id="js-datos-finca-telefono">\n            </div>',
      '<div id="js-datos-finca-telefono">665 548 144</div>'
    );
    const d = habitacliaAdapter.parseDetail!({
      body: html,
      url: "https://www.habitaclia.com/i500006042448.htm?from=list",
    });
    expect(d.contacto_telefono).toBe("+34665548144");
    expect(d.descripcion).toMatch(/urbanizaci/i);
    expect(d.descripcion!.length).toBeGreaterThan(100);
    expect(d.direccion).toMatch(/Catofa/i);
    expect(d.fotos!.length).toBeGreaterThanOrEqual(25);
    expect(d.publicado_en).toBe("2026-03-07T12:00:00.000Z");
  });

  it("buildListUrl A Coruña con slugs de portal_params", () => {
    const url = habitacliaAdapter.buildListUrl(
      {
        id: "z1",
        portal_id: "habitaclia",
        municipio: "A Coruña",
        provincia: "A Coruña",
        operacion: "venta",
        tipos_inmueble: [],
        portal_params: { provincia_slug: "a-coruna-provincia", municipio_slug: "a-coruna" },
      },
      1
    );
    expect(url).toBe(
      "https://www.habitaclia.com/comprar/viviendas/a-coruna-provincia/a-coruna/particulares/s"
    );
    expect(
      habitacliaAdapter.buildListUrl(
        {
          id: "z1",
          portal_id: "habitaclia",
          municipio: "A Coruña",
          provincia: "A Coruña",
          operacion: "venta",
          tipos_inmueble: [],
          portal_params: { provincia_slug: "a-coruna-provincia", municipio_slug: "a-coruna" },
        },
        2
      )
    ).toBe(
      "https://www.habitaclia.com/comprar/viviendas/a-coruna-provincia/a-coruna/particulares/s/2"
    );
  });
});
