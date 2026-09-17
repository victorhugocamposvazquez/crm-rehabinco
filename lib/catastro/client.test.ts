import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient } from "./client";
import { CATALOGO_TIMEOUT_MS } from "./constants";
import { CATASTRO_OVCERROR_STATUS, CatastroHttpError } from "./http";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";

type Llamada = { url: string; signal: AbortSignal | null | undefined };

function fetchFalso(responder: (url: string) => Response, llamadas: Llamada[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    llamadas.push({ url, signal: init?.signal });
    return responder(url);
  }) as typeof fetch;
}

function respuestaOvcError(): Response {
  const response = new Response("<html><title>The resource cannot be found.</title></html>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });
  Object.defineProperty(response, "url", { value: "https://ovc.catastro.meh.es/OVCError.aspx" });
  Object.defineProperty(response, "redirected", { value: true });
  return response;
}

describe("createCatastroClient (sin red)", () => {
  it("una redirección a OVCError se marca como error de Catastro, no como 404 normal", async () => {
    const llamadas: Llamada[] = [];
    const client = createCatastroClient({
      minIntervalMs: 0,
      cacheTtlMs: 0,
      fetchImpl: fetchFalso(() => respuestaOvcError(), llamadas),
    });
    await assert.rejects(
      client.obtenerDireccionesPorCodigoPostal({ codigoPostal: "46388" }),
      (error: unknown) =>
        error instanceof CatastroHttpError &&
        error.status === CATASTRO_OVCERROR_STATUS &&
        /OVCError/.test(error.message)
    );
    await assert.rejects(
      client.obtenerCallejero({ provincia: "VALENCIA", municipio: "GODELLETA" }),
      (error: unknown) => error instanceof CatastroHttpError && error.status === CATASTRO_OVCERROR_STATUS
    );
    assert.equal(llamadas.length, 2);
  });

  it("un 404 sin redirección sigue siendo un 404", async () => {
    const client = createCatastroClient({
      minIntervalMs: 0,
      cacheTtlMs: 0,
      fetchImpl: fetchFalso(() => new Response("no", { status: 404 }), []),
    });
    await assert.rejects(
      client.obtenerDireccionesPorCodigoPostal({ codigoPostal: "99999" }),
      (error: unknown) => error instanceof CatastroHttpError && error.status === 404
    );
  });

  it("el callejero completo y el listado por CP esperan más que el resto de consultas", async () => {
    const abortos: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    // Capturamos el ms con el que el cliente programa el abort de cada petición.
    globalThis.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
      if (typeof ms === "number" && ms >= 1_000) abortos.push(ms);
      return originalSetTimeout(fn as () => void, ms, ...rest);
    }) as typeof setTimeout;
    try {
      const client = createCatastroClient({
        minIntervalMs: 0,
        cacheTtlMs: 0,
        fetchImpl: fetchFalso(
          (url) =>
            /wfsAD/.test(url)
              ? new Response("<gml:FeatureCollection></gml:FeatureCollection>", { status: 200 })
              : new Response(JSON.stringify({ consulta_callejero: {} }), { status: 200 }),
          []
        ),
      });
      await client.obtenerCallejero({ provincia: "MADRID", municipio: "MADRID" });
      await client.obtenerDireccionesPorCodigoPostal({ codigoPostal: "28004" });
      await client.obtenerCallejero({ provincia: "MADRID", municipio: "MADRID", nomVia: "FUENCARRAL" });
      await client.obtenerMunicipios("MADRID");
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    assert.deepEqual(abortos, [CATALOGO_TIMEOUT_MS, CATALOGO_TIMEOUT_MS, 20_000, 20_000]);
  });
});

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
