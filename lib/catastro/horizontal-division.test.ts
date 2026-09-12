import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { detectHorizontalDivision } from "./horizontal-division";
import { CATALOGO_LTP } from "./ltp-catalogo";
import { parseConsultaDnp } from "./parse";
import {
  agruparPorFinca,
  resolverDivisionHorizontal,
  seleccionarReferenciaDetalle,
} from "./resolve-finca-ltp";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

describe("detectHorizontalDivision — ltp explícito", () => {
  it("Godelleta / literal sin DH → NO", () => {
    const result = detectHorizontalDivision({
      rawLtp: "Parcela construida sin división horizontal",
    });
    assert.equal(result.status, "NO");
    assert.equal(result.confidence, 1);
    assert.equal(result.evidence, "finca.ltp");
    assert.equal(result.rawLtp, "Parcela construida sin división horizontal");
  });

  it("Fuencarral / literal con DH → YES", () => {
    const result = detectHorizontalDivision({
      rawLtp: "Parcela con varios inmuebles (division horizontal)",
    });
    assert.equal(result.status, "YES");
    assert.equal(result.confidence, 1);
    assert.equal(result.evidence, "finca.ltp");
  });

  it("ltp desconocido → UNKNOWN", () => {
    const result = detectHorizontalDivision({ rawLtp: "Parcela rústica sin edificar" });
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.confidence, 0);
    assert.equal(result.evidence, "finca.ltp");
  });

  it("ltp urbano-rústico observado en Godelleta sigue UNKNOWN; no es NO", () => {
    const literal =
      "Parcela, a efectos catastrales, con inmuebles de distinta clase (urbano y rústico)";
    const result = detectHorizontalDivision({ rawLtp: literal });
    assert.equal(result.status, "UNKNOWN");
    assert.notEqual(result.status, "NO");
    assert.notEqual(result.status, "YES");
    assert.equal(result.evidence, "finca.ltp");
    assert.doesNotMatch(literal.normalize("NFD").replace(/\p{M}/gu, ""), /division horizontal/i);
  });

  it("literales del FAQ CAT no validados en WCF quedan UNKNOWN", () => {
    const result = detectHorizontalDivision({ rawLtp: "Parcela con un único inmueble." });
    assert.equal(result.status, "UNKNOWN");
    assert.ok(CATALOGO_LTP.some((item) => item.literal.startsWith("Parcela con un único")));
  });
});

describe("detectHorizontalDivision — no infiere", () => {
  it("varias unidades constructivas no provocan YES", () => {
    const result = detectHorizontalDivision({
      rawLtp: null,
      inmueblesCount: 1,
      construccionesCount: 6,
    });
    assert.equal(result.status, "UNKNOWN");
    assert.notEqual(result.status, "YES");
  });

  it("error de Catastro no se convierte en NO", () => {
    const result = detectHorizontalDivision({
      error: { codigo: "33", descripcion: "LA VÍA NO EXISTE" },
    });
    assert.equal(result.status, "UNKNOWN");
    assert.equal(result.evidence, "consulta.error");
    assert.notEqual(result.status, "NO");
  });
});

describe("agruparPorFinca", () => {
  it("agrupa por 14 caracteres y elige una sola RC de 20", () => {
    const consulta = parseConsultaDnp(loadFixture("dnploc-fuencarral-50.json"));
    const grupos = agruparPorFinca(consulta.results);
    assert.equal(grupos.size, 1);
    const inmuebles = grupos.get("0751301VK4705B") ?? [];
    assert.equal(inmuebles.length, 13);
    assert.equal(seleccionarReferenciaDetalle(inmuebles), "0751301VK4705B0002OI");
  });
});

describe("resolverDivisionHorizontal — casos reales", () => {
  it("Godelleta → NO sin consultar detalle extra", async () => {
    const consulta = parseConsultaDnp(loadFixture("dnploc-godelleta.json"));
    let llamadas = 0;
    const clasificaciones = await resolverDivisionHorizontal(consulta, {
      consultarReferencia: async () => {
        llamadas += 1;
        throw new Error("no debería consultarse");
      },
    });

    assert.equal(consulta.control.construcciones, 3);
    assert.equal(llamadas, 0);
    assert.equal(clasificaciones.length, 1);
    assert.equal(clasificaciones[0]?.status, "NO");
    assert.equal(clasificaciones[0]?.confidence, 1);
    assert.equal(clasificaciones[0]?.consultasDetalle, 0);
    assert.equal(clasificaciones[0]?.rawLtp, "Parcela construida sin división horizontal");
  });

  it("Fuencarral 50 → YES con una sola Consulta_DNPRC", async () => {
    const consulta = parseConsultaDnp(loadFixture("dnploc-fuencarral-50.json"));
    const refs: string[] = [];
    const clasificaciones = await resolverDivisionHorizontal(consulta, {
      consultarReferencia: async ({ refCat }) => {
        refs.push(refCat);
        return parseConsultaDnp(loadFixture("dnprc-fuencarral-unidad.json"));
      },
    });

    assert.equal(consulta.results.length, 13);
    assert.deepEqual(refs, ["0751301VK4705B0002OI"]);
    assert.equal(clasificaciones[0]?.status, "YES");
    assert.equal(clasificaciones[0]?.confidence, 1);
    assert.equal(clasificaciones[0]?.consultasDetalle, 1);
    assert.equal(
      clasificaciones[0]?.rawLtp,
      "Parcela con varios inmuebles (division horizontal)"
    );
  });

  it("error al consultar el detalle → UNKNOWN, nunca NO", async () => {
    const consulta = parseConsultaDnp(loadFixture("dnploc-fuencarral-50.json"));
    const clasificaciones = await resolverDivisionHorizontal(consulta, {
      consultarReferencia: async () =>
        parseConsultaDnp(loadFixture("dnploc-via-inexistente.json")),
    });
    assert.equal(clasificaciones[0]?.status, "UNKNOWN");
    assert.notEqual(clasificaciones[0]?.status, "NO");
  });
});
