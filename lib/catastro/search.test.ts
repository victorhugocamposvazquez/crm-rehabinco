import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient } from "./client";
import { parsearBusqueda, responderBusquedaCatastro } from "./search";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";
const usuarioPrueba = { id: "fase2-test" };

function requestDe(query: string) {
  return new Request(`http://localhost/api/catastro/search?${query}`);
}

async function leerJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("parsearBusqueda", () => {
  it("exige provincia, municipio, calle y numero", () => {
    const parsed = parsearBusqueda(new URLSearchParams("provincia=MADRID"));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.error, /municipio, calle, numero/);
    }
  });

  it("no inventa Sigla si la calle no trae un tipo del Anexo II", () => {
    const parsed = parsearBusqueda(
      new URLSearchParams(
        "provincia=VALENCIA&municipio=GODELLETA&calle=GUAYANA-MOJONERA&numero=3"
      )
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.match(parsed.error, /sigla/i);
    }
  });

  it("acepta sigla explícita o un tipo oficial delante de la calle", () => {
    const conSigla = parsearBusqueda(
      new URLSearchParams(
        "provincia=VALENCIA&municipio=GODELLETA&calle=GUAYANA-MOJONERA&numero=3&sigla=CL"
      )
    );
    assert.equal(conSigla.ok, true);
    if (conSigla.ok) {
      assert.equal(conSigla.consulta.sigla, "CL");
      assert.equal(conSigla.consulta.calle, "GUAYANA-MOJONERA");
      assert.equal(conSigla.query.sigla, "CL");
    }

    const conTipo = parsearBusqueda(
      new URLSearchParams(
        "provincia=MADRID&municipio=MADRID&calle=Calle+Fuencarral&numero=50"
      )
    );
    assert.equal(conTipo.ok, true);
    if (conTipo.ok) {
      assert.equal(conTipo.consulta.sigla, "CL");
      assert.equal(conTipo.consulta.calle, "Fuencarral");
    }
  });
});

describe("responderBusquedaCatastro", () => {
  it("responde 401 sin sesión", async () => {
    const response = await responderBusquedaCatastro(
      requestDe("provincia=MADRID&municipio=MADRID&calle=Calle+Alcala&numero=20"),
      null
    );
    assert.equal(response.status, 401);
    const body = await leerJson(response);
    assert.equal(body.error, "Sesión expirada");
  });

  it("responde 400 si faltan datos o sigla", async () => {
    const incompleta = await responderBusquedaCatastro(requestDe("provincia=MADRID"), usuarioPrueba);
    assert.equal(incompleta.status, 400);

    const sinSigla = await responderBusquedaCatastro(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&calle=GUAYANA-MOJONERA&numero=3"),
      usuarioPrueba
    );
    assert.equal(sinSigla.status, 400);
    const body = await leerJson(sinSigla);
    assert.match(String(body.error), /sigla/i);
  });
});

describe("GET /api/catastro/search contra Catastro", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });

  it("devuelve detalle + raw + finca.ltp literal en el ejemplo oficial", async () => {
    const response = await responderBusquedaCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&calle=GUAYANA-MOJONERA&numero=3"
      ),
      usuarioPrueba,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);

    assert.equal(body.operacion, "Consulta_DNPLOC");
    assert.equal(body.tipo, "detalle");
    assert.equal((body.query as { sigla: string }).sigla, "CL");
    assert.equal((body.queryCatastro as { Sigla: string }).Sigla, "CL");
    assert.equal((body.queryCatastro as { Calle: string }).Calle, "GUAYANA-MOJONERA");
    assert.ok(body.raw);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "horizontalDivision"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "horizontalDivisionStatus"), false);

    const results = body.results as Array<Record<string, unknown>>;
    assert.equal(results.length, 1);
    assert.equal(results[0]?.referenciaCatastral, "2749704YJ0624N0001DI");
    assert.equal(results[0]?.superficie, 94);
    assert.equal(results[0]?.anio, 1976);
    assert.equal(results[0]?.uso, "Residencial");
    assert.equal((results[0]?.unidades as unknown[]).length, 3);
    assert.equal(
      (results[0]?.finca as { tipoLiteral: string }).tipoLiteral,
      "Parcela construida sin división horizontal"
    );
  });

  it("devuelve lista de inmuebles sin inventar finca ni unidades", async () => {
    const response = await responderBusquedaCatastro(
      requestDe("provincia=MADRID&municipio=MADRID&calle=Calle+Fuencarral&numero=50"),
      usuarioPrueba,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const results = body.results as Array<Record<string, unknown>>;

    assert.equal(body.tipo, "lista");
    assert.ok(results.length > 1);
    assert.ok(results.every((item) => item.finca === null));
    assert.ok(results.every((item) => Array.isArray(item.unidades) && item.unidades.length === 0));
    assert.ok(body.raw);
  });

  it("propaga el error oficial si la vía no existe", async () => {
    const response = await responderBusquedaCatastro(
      requestDe("provincia=MADRID&municipio=MADRID&sigla=CL&calle=NOEXISTEXYZ&numero=1"),
      usuarioPrueba,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal(body.tipo, "error");
    assert.equal((body.error as { codigo: string }).codigo, "33");
    assert.deepEqual(body.results, []);
  });
});
