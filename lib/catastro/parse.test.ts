import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseConsultaDnp, parseNumeroCatastral, separarTipoVia } from "./parse";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

describe("parseNumeroCatastral", () => {
  it("acepta enteros y decimales con coma oficial", () => {
    assert.equal(parseNumeroCatastral("94"), 94);
    assert.equal(parseNumeroCatastral("100,000000"), 100);
    assert.equal(parseNumeroCatastral("6,000000"), 6);
    assert.equal(parseNumeroCatastral(""), null);
    assert.equal(parseNumeroCatastral(undefined), null);
  });
});

describe("separarTipoVia", () => {
  it("respeta la sigla oficial si se indica", () => {
    assert.deepEqual(separarTipoVia("GUAYANA-MOJONERA", "CL"), {
      sigla: "CL",
      calle: "GUAYANA-MOJONERA",
    });
  });

  it("extrae códigos y nombres del Anexo II", () => {
    assert.deepEqual(separarTipoVia("CL REAL"), { sigla: "CL", calle: "REAL" });
    assert.deepEqual(separarTipoVia("Calle Fuencarral"), {
      sigla: "CL",
      calle: "Fuencarral",
    });
  });

  it("no inventa sigla si la vía no empieza por un tipo oficial", () => {
    assert.deepEqual(separarTipoVia("GUAYANA-MOJONERA"), {
      sigla: "",
      calle: "GUAYANA-MOJONERA",
    });
  });
});

describe("parseConsultaDnp", () => {
  it("normaliza un detalle con finca y unidades constructivas", () => {
    const raw = loadFixture("dnploc-godelleta.json");
    const parsed = parseConsultaDnp(raw, { Provincia: "VALENCIA" });

    assert.equal(parsed.tipo, "detalle");
    assert.equal(parsed.operacion, "Consulta_DNPLOC");
    assert.equal(parsed.control.inmuebles, 1);
    assert.equal(parsed.results.length, 1);
    assert.equal(parsed.raw, raw);

    const item = parsed.results[0];
    assert.equal(item.referenciaCatastral, "2749704YJ0624N0001DI");
    assert.equal(item.referenciaParcela, "2749704YJ0624N");
    assert.equal(item.uso, "Residencial");
    assert.equal(item.superficie, 94);
    assert.equal(item.anio, 1976);
    assert.equal(item.direccion.via, "GUAYANA-MOJONERA");
    assert.equal(item.direccion.numero, "3");
    assert.equal(item.direccion.codigoPostal, "46388");
    assert.equal(item.finca?.tipoLiteral, "Parcela construida sin división horizontal");
    assert.equal(item.finca?.superficieSolar, 839);
    assert.equal(item.unidades.length, 3);
    assert.equal(item.unidades[0]?.uso, "VIVIENDA");
    assert.ok(item.raw);
  });

  it("normaliza una lista de inmuebles sin inventar finca", () => {
    const raw = loadFixture("dnploc-fuencarral-50.json");
    const parsed = parseConsultaDnp(raw);

    assert.equal(parsed.tipo, "lista");
    assert.equal(parsed.control.inmuebles, 13);
    assert.equal(parsed.results.length, 13);
    assert.equal(parsed.results[0]?.referenciaParcela, "0751301VK4705B");
    assert.equal(parsed.results[0]?.referenciaCatastral, "0751301VK4705B0002OI");
    assert.equal(parsed.results[0]?.finca, null);
    assert.deepEqual(parsed.results[0]?.unidades, []);
    assert.ok(
      parsed.results.every((item) => item.referenciaParcela === "0751301VK4705B")
    );
  });

  it("conserva el literal oficial de finca en un detalle de unidad", () => {
    const raw = loadFixture("dnprc-fuencarral-unidad.json");
    const parsed = parseConsultaDnp(raw);

    assert.equal(parsed.tipo, "detalle");
    assert.equal(parsed.operacion, "Consulta_DNPRC");
    assert.equal(parsed.results[0]?.referenciaCatastral, "0751301VK4705B0003PO");
    assert.equal(
      parsed.results[0]?.finca?.tipoLiteral,
      "Parcela con varios inmuebles (division horizontal)"
    );
    assert.equal(parsed.results[0]?.coeficienteParticipacion, 6);
    assert.equal(parsed.results[0]?.unidades.length, 2);
  });

  it("propaga errores oficiales de Catastro", () => {
    const raw = loadFixture("dnploc-via-inexistente.json");
    const parsed = parseConsultaDnp(raw);

    assert.equal(parsed.tipo, "error");
    assert.equal(parsed.error?.codigo, "33");
    assert.equal(parsed.error?.descripcion, "LA VÍA NO EXISTE");
    assert.deepEqual(parsed.results, []);
    assert.equal(parsed.raw, raw);
  });
});
