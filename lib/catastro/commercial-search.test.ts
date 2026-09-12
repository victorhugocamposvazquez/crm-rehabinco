import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient, type CatastroClient } from "./client";
import {
  buscarFincasComerciales,
  compararNumeroOficial,
  ordenarFincasComerciales,
} from "./commercial-search";
import { createDiscoveryStore } from "./discovery-session";
import { CatastroHttpError } from "./http";
import { crearStoreMemoriaExplorer } from "./explorer";
import { responderBusquedaComercial } from "./search-commercial";
import { LTP_MIXTO_URBANO_RUSTICO } from "./unknown-reason";
import type {
  ConsultaDireccion,
  ConsultaReferencia,
  DireccionNormalizada,
  InmuebleNormalizado,
  ResultadoConsultaCatastro,
} from "./types";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";
const usuario = { id: "fase10-test" };
const ltpNo = "Parcela construida sin división horizontal";
const ltpYes = "Parcela con varios inmuebles (division horizontal)";
const ltpUnknown = "Parcela rústica sin edificar";
const base = {
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  sigla: "CL",
  via: "DEMO",
};

const DIR_VACIA: DireccionNormalizada = {
  tipoVia: null,
  via: null,
  numero: null,
  numero2: null,
  bloque: null,
  escalera: null,
  planta: null,
  puerta: null,
  codigoPostal: null,
  provincia: null,
  municipio: null,
  literal: null,
};

function requestDe(query: string) {
  return new Request(`http://localhost/api/catastro/search?${query}`);
}

async function leerJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function gmlPortales(items: Array<{ numero: string }>, attrs = ""): string {
  const miembros = items
    .map(
      (item) => `<gml:featureMember>
        <ad:Address>
          <base:localId>46.138.57.${item.numero}</base:localId>
          <ad:LocatorDesignator><ad:designator>${item.numero}</ad:designator></ad:LocatorDesignator>
        </ad:Address>
      </gml:featureMember>`
    )
    .join("");
  return `<gml:FeatureCollection ${attrs}>${miembros}</gml:FeatureCollection>`;
}

function inmueble(opts: {
  rc20: string;
  numero: string;
  cp?: string;
  ltp?: string;
}): InmuebleNormalizado {
  return {
    referenciaCatastral: opts.rc20,
    referenciaParcela: opts.rc20.slice(0, 14),
    cargo: opts.rc20.slice(14, 18),
    tipoBien: "UR",
    direccion: {
      ...DIR_VACIA,
      tipoVia: "CL",
      via: "DEMO",
      numero: opts.numero,
      codigoPostal: opts.cp ?? "46388",
      provincia: "VALENCIA",
      municipio: "GODELLETA",
    },
    superficie: 50,
    anio: 1976,
    uso: "Residencial",
    coeficienteParticipacion: 100,
    finca: opts.ltp
      ? { literal: null, tipoLiteral: opts.ltp, superficieSolar: null, urlGrafico: null }
      : null,
    unidades: [],
    raw: null,
  };
}

function consultaOk(results: InmuebleNormalizado[]): ResultadoConsultaCatastro {
  return {
    query: {},
    operacion: "Consulta_DNPLOC",
    tipo: results.length > 1 ? "lista" : "detalle",
    control: { inmuebles: results.length, construcciones: null, errores: null },
    error: null,
    results,
    raw: {},
  };
}

function consultaError(codigo: string, descripcion: string): ResultadoConsultaCatastro {
  return {
    query: {},
    operacion: "Consulta_DNPLOC",
    tipo: "error",
    control: { inmuebles: null, construcciones: null, errores: 1 },
    error: { codigo, descripcion },
    results: [],
    raw: {},
  };
}

function mockClient(opts: {
  portales?: Array<{ numero: string }>;
  gmlAttrs?: string;
  porNumero: Record<string, ResultadoConsultaCatastro | Error>;
  viaInexistente?: boolean;
}): CatastroClient {
  const portales = opts.portales ?? [{ numero: "3" }, { numero: "5" }, { numero: "7" }];
  return {
    consultarDireccion: async (consulta: ConsultaDireccion) => {
      const respuesta = opts.porNumero[consulta.numero];
      if (respuesta instanceof Error) throw respuesta;
      if (!respuesta) throw new Error(`sin mock para ${consulta.numero}`);
      return respuesta;
    },
    consultarReferencia: async (_consulta: ConsultaReferencia) =>
      consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]),
    consultarPoligonoParcela: async () => {
      throw new Error("no usado");
    },
    obtenerProvincias: async () => {
      throw new Error("no usado");
    },
    obtenerMunicipios: async () => ({
      consulta_municipieroResult: {
        municipiero: { muni: [{ locat: { cd: "46", cmc: "138" }, nm: "GODELLETA" }] },
      },
    }),
    obtenerCallejero: async () =>
      opts.viaInexistente
        ? {
            consulta_callejeroResult: {
              control: { cuerr: 1 },
              lerr: { err: [{ cod: "10", des: "NO HAY COINCIDENCIAS EN LA BÚSQUEDA DE VÍAS" }] },
            },
          }
        : {
            consulta_callejeroResult: {
              callejero: { calle: [{ dir: { cv: "57", tv: "CL", nv: "DEMO" } }] },
            },
          },
    obtenerNumerero: async () => {
      throw new Error("no usado");
    },
    obtenerDireccionesPorCodigoVia: async () => gmlPortales(portales, opts.gmlAttrs),
    getStats: () => ({ fetches: 0, cacheHits: 0 }),
  };
}

function clienteMixto() {
  return mockClient({
    porNumero: {
      "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]),
      "5": consultaOk([inmueble({ rc20: "0751301VK4705B0001AA", numero: "5", ltp: ltpYes })]),
      "7": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "7", ltp: ltpUnknown })]),
    },
  });
}

async function refsDe(criterios: Parameters<typeof buscarFincasComerciales>[0], client = clienteMixto()) {
  const ejecucion = await buscarFincasComerciales(criterios, {
    client,
    store: createDiscoveryStore(),
  });
  assert.equal(ejecucion.ok, true);
  if (!ejecucion.ok) throw new Error("esperado ok");
  return {
    ejecucion,
    refs: ejecucion.resultado.results.map((item) => item.fincaReference),
    resultado: ejecucion.resultado,
  };
}

describe("buscarFincasComerciales", () => {
  it("1. búsqueda por número", async () => {
    const { refs, resultado } = await refsDe(
      { ...base, numero: "3" },
      mockClient({
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo })]),
        },
      })
    );
    assert.deepEqual(refs, ["2749704YJ0624N"]);
    assert.equal(resultado.pagination.hasNextPage, false);
    assert.equal(resultado.coverage.complete, true);
    assert.ok(resultado.results[0]?.properties.length === 1);
  });

  it("17. número concreto no pagina", async () => {
    const { resultado } = await refsDe(
      { ...base, numero: "3", pageSize: 1 },
      mockClient({
        portales: [{ numero: "3" }, { numero: "5" }, { numero: "7" }],
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo })]),
        },
      })
    );
    assert.equal(resultado.pagination.hasNextPage, false);
    assert.equal(resultado.pagination.nextCursor, undefined);
    assert.equal(resultado.coverage.portalsProcessed, 1);
  });

  it("2. búsqueda por calle", async () => {
    const { refs, resultado } = await refsDe({ ...base });
    assert.equal(refs.length, 3);
    assert.equal(resultado.coverage.portalsFound, 3);
    assert.equal(resultado.search.horizontalDivision, "ALL");
  });

  it("3. filtro NO", async () => {
    const { refs, resultado } = await refsDe({ ...base, horizontalDivision: "NO" });
    assert.deepEqual(refs, ["AAAAAAAAAAAAAA"]);
    assert.ok(resultado.results.every((item) => item.horizontalDivision.status === "NO"));
  });

  it("4. filtro YES", async () => {
    const { refs } = await refsDe({ ...base, horizontalDivision: "YES" });
    assert.deepEqual(refs, ["0751301VK4705B"]);
  });

  it("5. filtro UNKNOWN", async () => {
    const { refs, resultado } = await refsDe({ ...base, horizontalDivision: "UNKNOWN" });
    assert.deepEqual(refs, ["CCCCCCCCCCCCCC"]);
    assert.ok(resultado.results.every((item) => item.horizontalDivision.status === "UNKNOWN"));
    assert.equal(resultado.results[0]?.horizontalDivision.reasonCode, "LTP_UNRECOGNIZED");
  });

  it("7. API comercial expone reasonCode y UNKNOWN agrupa todos los motivos", async () => {
    const { refs, resultado } = await refsDe(
      { ...base, horizontalDivision: "UNKNOWN" },
      mockClient({
        porNumero: {
          "3": consultaOk([
            inmueble({ rc20: "MIXMIXMIXMIXMI0001AA", numero: "3", ltp: LTP_MIXTO_URBANO_RUSTICO }),
          ]),
          "5": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "5", ltp: ltpUnknown })]),
        },
        portales: [{ numero: "3" }, { numero: "5" }],
      })
    );
    assert.deepEqual(refs.sort(), ["CCCCCCCCCCCCCC", "MIXMIXMIXMIXMI"]);
    const mixto = resultado.results.find((item) => item.fincaReference === "MIXMIXMIXMIXMI");
    assert.equal(mixto?.horizontalDivision.status, "UNKNOWN");
    assert.equal(mixto?.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
  });

  it("6. ALL equivale a omitir el filtro", async () => {
    const omitido = await refsDe({ ...base });
    const all = await refsDe({ ...base, horizontalDivision: "ALL" });
    assert.deepEqual(omitido.refs, all.refs);
    assert.equal(omitido.refs.length, 3);
  });

  it("7. filtro CP no se envía a Catastro", async () => {
    const consultados: string[] = [];
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", cp: "46388", ltp: ltpNo }),
        ]),
        "5": consultaOk([
          inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "5", cp: "28004", ltp: ltpNo }),
        ]),
        "7": consultaOk([
          inmueble({ rc20: "0751301VK4705B0001AA", numero: "7", cp: "46388", ltp: ltpYes }),
        ]),
      },
    });
    const original = client.consultarDireccion;
    client.consultarDireccion = async (consulta) => {
      consultados.push(consulta.numero);
      return original(consulta);
    };
    const { refs } = await refsDe({ ...base, postalCode: "46388" }, client);
    assert.deepEqual(consultados, ["3", "5", "7"]);
    assert.deepEqual(refs.sort(), ["0751301VK4705B", "AAAAAAAAAAAAAA"]);
  });

  it("20. CP + NO", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", cp: "46388", ltp: ltpNo }),
        ]),
        "5": consultaOk([
          inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "5", cp: "28004", ltp: ltpNo }),
        ]),
        "7": consultaOk([
          inmueble({ rc20: "0751301VK4705B0001AA", numero: "7", cp: "46388", ltp: ltpYes }),
        ]),
      },
    });
    const { refs } = await refsDe(
      { ...base, postalCode: "46388", horizontalDivision: "NO" },
      client
    );
    assert.deepEqual(refs, ["AAAAAAAAAAAAAA"]);
  });

  it("13. búsqueda por calle con CP evita DNPRC de fincas ajenas", async () => {
    let dnprc = 0;
    const client = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", cp: "46388" })]),
        "5": consultaOk([inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "5", cp: "28004" })]),
        "7": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "7", cp: "46388" })]),
      },
    });
    const original = client.consultarReferencia;
    client.consultarReferencia = async (consulta) => {
      dnprc += 1;
      return original(consulta);
    };
    const ejecucion = await buscarFincasComerciales({ ...base, postalCode: "46388" }, { client });
    assert.equal(ejecucion.ok, true);
    if (!ejecucion.ok) throw new Error("unreachable");
    assert.equal(dnprc, 2);
    assert.equal(ejecucion.discovery.prefilter.dnprcAvoidedByPostalCode, 1);
    assert.deepEqual(
      ejecucion.resultado.results.map((finca) => finca.fincaReference).sort(),
      ["AAAAAAAAAAAAAA", "CCCCCCCCCCCCCC"]
    );
  });

  it("8. sin candidatos es 200 con results []", async () => {
    const response = await responderBusquedaComercial(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO&horizontalDivision=YES&numero=3"),
      usuario,
      mockClient({
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo })]),
        },
      })
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal(body.ok, true);
    assert.deepEqual(body.results, []);
  });

  it("9, 14 y 15. paginación no declara exhaustivo", async () => {
    const store = createDiscoveryStore();
    const client = mockClient({
      portales: [
        { numero: "10" },
        { numero: "11" },
        { numero: "12" },
        { numero: "13" },
        { numero: "14" },
        { numero: "15" },
      ],
      porNumero: {
        "10": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", ltp: ltpNo })]),
        "11": consultaOk([inmueble({ rc20: "0751301VK4705B0001AA", numero: "11", ltp: ltpYes })]),
        "12": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12", ltp: ltpNo })]),
        "13": consultaOk([inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "13", ltp: ltpYes })]),
        "14": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "14", ltp: ltpNo })]),
        "15": consultaOk([inmueble({ rc20: "DDDDDDDDDDDDDD0001AA", numero: "15", ltp: ltpYes })]),
      },
    });
    const p1 = await buscarFincasComerciales(
      { ...base, pageSize: 2, horizontalDivision: "NO" },
      { client, store }
    );
    assert.equal(p1.ok, true);
    if (!p1.ok) throw new Error("esperado ok");
    assert.equal(p1.resultado.pagination.hasNextPage, true);
    assert.ok(p1.resultado.pagination.nextCursor);
    assert.equal(p1.resultado.coverage.complete, false);
    assert.equal(p1.resultado.coverage.completeCandidates, false);
    assert.deepEqual(
      p1.resultado.results.map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.deepEqual(p1.resultado.results[0]?.portals, ["10"]);

    const p2 = await buscarFincasComerciales(
      { cursor: p1.resultado.pagination.nextCursor, horizontalDivision: "NO" },
      { client, store }
    );
    assert.equal(p2.ok, true);
    if (!p2.ok) throw new Error("esperado ok");
    assert.equal(p2.resultado.coverage.completeCandidates, false);
    assert.deepEqual(p2.resultado.results[0]?.portals, ["10", "12"]);
  });

  it("10 y 11. deduplicación y finca en varias páginas", async () => {
    const store = createDiscoveryStore();
    const client = mockClient({
      portales: [{ numero: "10" }, { numero: "12" }],
      porNumero: {
        "10": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", ltp: ltpNo })]),
        "12": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12", ltp: ltpNo })]),
      },
    });
    const p1 = await buscarFincasComerciales({ ...base, pageSize: 1 }, { client, store });
    assert.equal(p1.ok, true);
    if (!p1.ok) throw new Error("esperado ok");
    const p2 = await buscarFincasComerciales(
      { cursor: p1.resultado.pagination.nextCursor },
      { client, store }
    );
    assert.equal(p2.ok, true);
    if (!p2.ok) throw new Error("esperado ok");
    assert.equal(p1.resultado.results.length, 1);
    assert.equal(p2.resultado.results.length, 1);
    assert.equal(p1.resultado.results[0]?.fincaReference, "AAAAAAAAAAAAAA");
    assert.equal(p2.resultado.results[0]?.fincaReference, "AAAAAAAAAAAAAA");
    assert.deepEqual(p2.resultado.results[0]?.portals, ["10", "12"]);
  });

  it("12. ordenación determinista por numeración oficial", () => {
    assert.ok(compararNumeroOficial("3", "12") < 0);
    assert.equal(compararNumeroOficial("10A", "10-BIS") !== 0, true);
    const ordenadas = ordenarFincasComerciales([
      {
        fincaReference: "BBBBBBBBBBBBBB",
        propertyReferences: ["BBBBBBBBBBBBBB0001AA"],
        properties: [],
        portals: ["12"],
        address: { provincia: "X", municipio: "Y", sigla: "CL", via: "Z", numero: "12" },
        postalCodes: [],
        horizontalDivision: { status: "NO", confidence: 1, reason: "n" },
      },
      {
        fincaReference: "AAAAAAAAAAAAAA",
        propertyReferences: ["AAAAAAAAAAAAAA0001AA"],
        properties: [],
        portals: ["3"],
        address: { provincia: "X", municipio: "Y", sigla: "CL", via: "Z", numero: "3" },
        postalCodes: [],
        horizontalDivision: { status: "NO", confidence: 1, reason: "n" },
      },
    ]);
    assert.deepEqual(
      ordenadas.map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA", "BBBBBBBBBBBBBB"]
    );
  });

  it("13. errores parciales → usable y completeCandidates false", async () => {
    const { resultado } = await refsDe(
      { ...base, horizontalDivision: "NO" },
      mockClient({
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]),
          "5": consultaError("11", "ERROR PARCIAL"),
          "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
        },
      })
    );
    assert.equal(resultado.results.length, 2);
    assert.equal(resultado.coverage.completeCandidates, false);
  });

  it("16. possibleCut impide complete y completeCandidates", async () => {
    const { resultado } = await refsDe(
      { ...base, horizontalDivision: "NO" },
      mockClient({
        gmlAttrs: 'numberMatched="9000" numberReturned="3"',
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]),
          "5": consultaOk([inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "5", ltp: ltpNo })]),
          "7": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "7", ltp: ltpNo })]),
        },
      })
    );
    assert.equal(resultado.coverage.possibleCut, true);
    assert.equal(resultado.coverage.complete, false);
    assert.equal(resultado.coverage.completeCandidates, false);
    assert.equal(resultado.results.length, 3);
  });

  it("18. validación de criterios", async () => {
    const incompleta = await buscarFincasComerciales({ provincia: "MADRID" });
    assert.equal(incompleta.ok, false);
    if (!incompleta.ok) assert.equal(incompleta.code, "invalid");

    const sinSigla = await buscarFincasComerciales({
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      via: "DEMO",
    });
    assert.equal(sinSigla.ok, false);

    const filtro = await buscarFincasComerciales({ ...base, horizontalDivision: "TALVEZ" });
    assert.equal(filtro.ok, false);
  });

  it("18b. vía oficial sin direcciones INSPIRE (WFS → OVCError 404) = 0 portales, no error", async () => {
    const sinDirecciones: CatastroClient = {
      ...mockClient({ porNumero: {} }),
      obtenerDireccionesPorCodigoVia: async () => {
        throw new CatastroHttpError("Catastro respondió HTTP 404", 404, "https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx");
      },
    };
    const ejecucion = await buscarFincasComerciales(base, { client: sinDirecciones, store: createDiscoveryStore() });
    assert.equal(ejecucion.ok, true);
    if (!ejecucion.ok) throw new Error("esperado ok");
    assert.equal(ejecucion.resultado.results.length, 0);
    assert.equal(ejecucion.resultado.coverage.portalsFound, 0);
    assert.equal(ejecucion.resultado.coverage.complete, true);
    assert.equal(ejecucion.resultado.pagination.hasNextPage, false);
    assert.match(ejecucion.discovery.discovery.limitation ?? "", /HTTP 404/);

    // Una caída real (5xx) sigue siendo error externo.
    const caido: CatastroClient = {
      ...mockClient({ porNumero: {} }),
      obtenerDireccionesPorCodigoVia: async () => {
        throw new CatastroHttpError("Catastro respondió HTTP 503", 503, "https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx");
      },
    };
    const fallo = await buscarFincasComerciales(base, { client: caido, store: createDiscoveryStore() });
    assert.equal(fallo.ok, false);
    if (!fallo.ok) assert.equal(fallo.code, "upstream");
  });

  it("19. HTTP 401 / 400 / 404 y contrato comercial", async () => {
    const sinSesion = await responderBusquedaComercial(requestDe("provincia=VALENCIA"), null);
    assert.equal(sinSesion.status, 401);

    const invalida = await responderBusquedaComercial(requestDe("provincia=VALENCIA"), usuario);
    assert.equal(invalida.status, 400);

    const inexistente = await responderBusquedaComercial(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO"),
      usuario,
      mockClient({ viaInexistente: true, porNumero: {} })
    );
    assert.equal(inexistente.status, 404);

    const ok = await responderBusquedaComercial(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO&numero=3"),
      usuario,
      mockClient({
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo })]),
        },
      })
    );
    assert.equal(ok.status, 200);
    const body = await leerJson(ok);
    assert.deepEqual(Object.keys(body).sort(), ["coverage", "ok", "pagination", "results", "search"]);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "fetches"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "cacheHits"), false);
  });

  it("una caída de ExplorerStore no convierte Catastro en error", async () => {
    const explorerStore = crearStoreMemoriaExplorer();
    explorerStore.putSearch = async () => {
      throw new Error("SUPABASE_DOWN");
    };
    const response = await responderBusquedaComercial(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO&numero=3"),
      usuario,
      mockClient({
        porNumero: {
          "3": consultaOk([inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo })]),
        },
      }),
      undefined,
      { explorerStore }
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.results), true);
    assert.equal(body.results[0]?.fincaReference, "2749704YJ0624N");
  });
});

describe("GET comercial contra Catastro", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });

  it("Godelleta 3 + NO → 2749704YJ0624N", async () => {
    const ejecucion = await buscarFincasComerciales(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
        horizontalDivision: "NO",
      },
      { client }
    );
    assert.equal(ejecucion.ok, true);
    if (!ejecucion.ok) throw new Error("esperado ok");
    assert.equal(ejecucion.resultado.results[0]?.fincaReference, "2749704YJ0624N");
    assert.equal(ejecucion.resultado.results[0]?.horizontalDivision.status, "NO");
    assert.equal(ejecucion.resultado.pagination.hasNextPage, false);
  });

  it("Fuencarral 50 + NO → []", async () => {
    const ejecucion = await buscarFincasComerciales(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
        numero: "50",
        horizontalDivision: "NO",
      },
      { client }
    );
    assert.equal(ejecucion.ok, true);
    if (!ejecucion.ok) throw new Error("esperado ok");
    assert.deepEqual(ejecucion.resultado.results, []);
    assert.equal(ejecucion.resultado.coverage.complete, true);
  });

  it("Godelleta sin número + NO devuelve candidatas", async () => {
    const ejecucion = await buscarFincasComerciales(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        horizontalDivision: "NO",
      },
      { client }
    );
    assert.equal(ejecucion.ok, true);
    if (!ejecucion.ok) throw new Error("esperado ok");
    assert.ok(
      ejecucion.resultado.results.some((item) => item.fincaReference === "2749704YJ0624N")
    );
    assert.ok(ejecucion.resultado.results.every((item) => item.horizontalDivision.status === "NO"));
  });

  it("Fuencarral páginas pequeñas: sin duplicados y completeCandidates false", async () => {
    const store = createDiscoveryStore();
    const p1 = await buscarFincasComerciales(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
        pageSize: 3,
        horizontalDivision: "NO",
      },
      { client, store }
    );
    assert.equal(p1.ok, true);
    if (!p1.ok) throw new Error("esperado ok");
    assert.equal(p1.resultado.pagination.hasNextPage, true);
    assert.equal(p1.resultado.coverage.completeCandidates, false);
    const p2 = await buscarFincasComerciales(
      { cursor: p1.resultado.pagination.nextCursor, horizontalDivision: "NO" },
      { client, store }
    );
    assert.equal(p2.ok, true);
    if (!p2.ok) throw new Error("esperado ok");
    assert.equal(p2.resultado.coverage.completeCandidates, false);
    const refs = [
      ...p1.resultado.results.map((item) => item.fincaReference),
      ...p2.resultado.results.map((item) => item.fincaReference),
    ];
    const porPagina = new Map<string, number>();
    for (const ref of refs) porPagina.set(ref, (porPagina.get(ref) ?? 0) + 1);
    for (const finca of [...p1.resultado.results, ...p2.resultado.results]) {
      assert.equal(finca.horizontalDivision.status, "NO");
      assert.equal(finca.fincaReference.length, 14);
    }
  });

  it("19. cache HTTP en repetición de Godelleta 3", async () => {
    const antes = client.getStats();
    const ejecucion = await buscarFincasComerciales(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
        horizontalDivision: "NO",
      },
      { client }
    );
    assert.equal(ejecucion.ok, true);
    const despues = client.getStats();
    assert.ok(despues.cacheHits > antes.cacheHits);
    assert.equal(despues.fetches, antes.fetches);
  });
});
