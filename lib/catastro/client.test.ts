import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient } from "./client";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";

describe("createCatastroClient", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });

  it("consulta el ejemplo oficial por referencia y conserva raw + normalizado", async () => {
    const resultado = await client.consultarReferencia({
      refCat: "2749704YJ0624N0001DI",
    });

    assert.equal(resultado.operacion, "Consulta_DNPRC");
    assert.equal(resultado.tipo, "detalle");
    assert.equal(resultado.query.RefCat, "2749704YJ0624N0001DI");
    assert.ok(resultado.raw);
    assert.equal(resultado.results[0]?.referenciaCatastral, "2749704YJ0624N0001DI");
    assert.equal(resultado.results[0]?.direccion.via, "GUAYANA-MOJONERA");
    assert.equal(
      resultado.results[0]?.finca?.tipoLiteral,
      "Parcela construida sin división horizontal"
    );
  });

  it("consulta una dirección real con parámetros oficiales de Consulta_DNPLOC", async () => {
    const resultado = await client.consultarDireccion({
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      calle: "GUAYANA-MOJONERA",
      numero: "3",
    });

    assert.equal(resultado.operacion, "Consulta_DNPLOC");
    assert.equal(resultado.tipo, "detalle");
    assert.equal(resultado.query.Sigla, "CL");
    assert.equal(resultado.query.Calle, "GUAYANA-MOJONERA");
    assert.equal(resultado.query.Numero, "3");
    assert.equal(resultado.results[0]?.referenciaParcela, "2749704YJ0624N");
    assert.equal(resultado.results[0]?.unidades.length, 3);
  });

  it("devuelve lista cuando la dirección tiene varios inmuebles", async () => {
    const resultado = await client.consultarDireccion({
      provincia: "MADRID",
      municipio: "MADRID",
      calle: "Calle Fuencarral",
      numero: "50",
    });

    assert.equal(resultado.tipo, "lista");
    assert.ok((resultado.control.inmuebles ?? 0) > 1);
    assert.equal(resultado.results.length, resultado.control.inmuebles);
    assert.ok(resultado.results.every((item) => item.finca === null));
  });

  it("no inventa inmuebles si Catastro responde error", async () => {
    const resultado = await client.consultarDireccion({
      provincia: "MADRID",
      municipio: "MADRID",
      sigla: "CL",
      calle: "NOEXISTEXYZ",
      numero: "1",
    });

    assert.equal(resultado.tipo, "error");
    assert.equal(resultado.error?.codigo, "33");
    assert.deepEqual(resultado.results, []);
  });
});
