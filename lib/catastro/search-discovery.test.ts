import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient, type CatastroClient } from "./client";
import { API_MAX_CONCURRENCY, API_MAX_PORTALS } from "./constants";
import { createDiscoveryStore } from "./discovery-session";
import { parsearDiscovery, responderDiscoveryCatastro } from "./search-discovery";
import { LTP_MIXTO_URBANO_RUSTICO } from "./unknown-reason";
import type {
  ConsultaDireccion,
  ConsultaReferencia,
  DireccionNormalizada,
  InmuebleNormalizado,
  ResultadoConsultaCatastro,
} from "./types";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";
const usuario = { id: "fase6-test" };

function requestDe(query: string) {
  return new Request(`http://localhost/api/catastro/search?${query}`);
}

async function leerJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

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

function gmlPortales(
  items: Array<{ numero: string }>,
  attrs = ""
): string {
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
  uso?: string;
  literal?: string;
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
      literal: opts.literal ?? null,
    },
    superficie: 50,
    anio: 1976,
    uso: opts.uso ?? "Residencial",
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
    raw: { interno: true },
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
    raw: { interno: true },
  };
}

function mockClient(opts: {
  portales?: Array<{ numero: string }>;
  gmlAttrs?: string;
  porNumero: Record<string, ResultadoConsultaCatastro | Error>;
  viaInexistente?: boolean;
  detalle?: ResultadoConsultaCatastro | Error;
}): CatastroClient {
  const portales = opts.portales ?? [{ numero: "3" }, { numero: "5" }, { numero: "7" }];
  const ltpNo = "Parcela construida sin división horizontal";
  return {
    consultarDireccion: async (consulta: ConsultaDireccion) => {
      const respuesta = opts.porNumero[consulta.numero];
      if (respuesta instanceof Error) throw respuesta;
      if (!respuesta) throw new Error(`sin mock para ${consulta.numero}`);
      return respuesta;
    },
    consultarReferencia: async (_consulta: ConsultaReferencia) => {
      if (opts.detalle instanceof Error) throw opts.detalle;
      if (opts.detalle) return opts.detalle;
      return consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]);
    },
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

describe("parsearDiscovery", () => {
  it("4. exige provincia, municipio, sigla y via", () => {
    const parsed = parsearDiscovery(new URLSearchParams("provincia=MADRID"));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.error, /municipio, sigla, via/);
  });

  it("5. no asume CL si falta sigla", () => {
    const parsed = parsearDiscovery(
      new URLSearchParams("provincia=VALENCIA&municipio=GODELLETA&via=GUAYANA-MOJONERA")
    );
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.match(parsed.error, /sigla/i);
  });

  it("normaliza espacios y mayúsculas sin aproximar la vía", () => {
    const parsed = parsearDiscovery(
      new URLSearchParams(
        "provincia=madrid&municipio=madrid&sigla=cl&via=Fuencarral&numero=%2050%20"
      )
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.query, {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
        numero: "50",
        postalCode: null,
      });
    }
  });

  it("acepta calle como alias de via y postalCode/codigoPostal", () => {
    const parsed = parsearDiscovery(
      new URLSearchParams(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&calle=GUAYANA-MOJONERA&codigoPostal=46388"
      )
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.query.via, "GUAYANA-MOJONERA");
      assert.equal(parsed.query.postalCode, "46388");
    }
  });

  it("8 y 9. rechaza maxPortals/concurrency inválidos y acota los enormes", () => {
    const negativo = parsearDiscovery(
      new URLSearchParams(
        "provincia=MADRID&municipio=MADRID&sigla=CL&via=FUENCARRAL&maxPortals=-1"
      )
    );
    assert.equal(negativo.ok, false);

    const enorme = parsearDiscovery(
      new URLSearchParams(
        "provincia=MADRID&municipio=MADRID&sigla=CL&via=FUENCARRAL&maxPortals=9999&concurrency=100"
      )
    );
    assert.equal(enorme.ok, true);
    if (enorme.ok) {
      assert.equal(enorme.options.maxPortals, API_MAX_PORTALS);
      assert.equal(enorme.options.concurrency, API_MAX_CONCURRENCY);
    }
  });

  it("horizontalDivision: ALL por defecto y valores válidos; inválido → error", () => {
    const base =
      "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO";
    const omitido = parsearDiscovery(new URLSearchParams(base));
    const all = parsearDiscovery(new URLSearchParams(`${base}&horizontalDivision=ALL`));
    const no = parsearDiscovery(new URLSearchParams(`${base}&horizontalDivision=no`));
    const na = parsearDiscovery(new URLSearchParams(`${base}&horizontalDivision=NOT_APPLICABLE`));
    const invalido = parsearDiscovery(new URLSearchParams(`${base}&horizontalDivision=maybe`));
    assert.equal(omitido.ok, true);
    assert.equal(all.ok, true);
    assert.equal(no.ok, true);
    assert.equal(na.ok, true);
    if (omitido.ok) assert.equal(omitido.options.horizontalDivision, "ALL");
    if (all.ok) assert.equal(all.options.horizontalDivision, "ALL");
    if (no.ok) assert.equal(no.options.horizontalDivision, "NO");
    if (na.ok) assert.equal(na.options.horizontalDivision, "NOT_APPLICABLE");
    assert.equal(invalido.ok, false);
  });
});

describe("responderDiscoveryCatastro", () => {
  const ltpNo = "Parcela construida sin división horizontal";
  const base =
    "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO";

  it("responde 401 sin sesión", async () => {
    const response = await responderDiscoveryCatastro(requestDe(`${base}&numero=3`), null);
    assert.equal(response.status, 401);
  });

  it("1. búsqueda con número", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo }),
        ]),
      },
    });
    const response = await responderDiscoveryCatastro(requestDe(`${base}&numero=3`), usuario, client);
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal(body.ok, true);
    const fincas = body.fincas as Array<Record<string, unknown>>;
    assert.equal(fincas[0]?.fincaReference, "2749704YJ0624N");
    assert.equal((fincas[0]?.horizontalDivision as { status: string }).status, "NO");
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, true);
  });

  it("2. búsqueda sin número", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });
    const response = await responderDiscoveryCatastro(requestDe(base), usuario, client);
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const portals = body.portals as Array<{ number: string }>;
    assert.deepEqual(portals.map((item) => item.number), ["3", "5", "7"]);
  });

  it("3. filtro CP no se envía a Catastro y solo recorta fincas", async () => {
    const consultados: string[] = [];
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "111111111111110001AA", numero: "3", cp: "46388", ltp: ltpNo }),
        ]),
        "5": consultaOk([
          inmueble({ rc20: "222222222222220001AA", numero: "5", cp: "28004", ltp: ltpNo }),
        ]),
        "7": consultaOk([
          inmueble({ rc20: "333333333333330001AA", numero: "7", cp: "46388", ltp: ltpNo }),
        ]),
      },
    });
    const original = client.consultarDireccion;
    client.consultarDireccion = async (consulta) => {
      consultados.push(consulta.numero);
      assert.equal(consulta.provincia, "VALENCIA");
      return original(consulta);
    };

    const response = await responderDiscoveryCatastro(
      requestDe(`${base}&postalCode=46388`),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.deepEqual(consultados, ["3", "5", "7"]);
    assert.equal((body.portals as unknown[]).length, 3);
    assert.equal((body.fincas as unknown[]).length, 2);
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, true);
  });

  it("4 y 5. parámetros obligatorios y sigla ausente → 400", async () => {
    const incompleta = await responderDiscoveryCatastro(requestDe("provincia=MADRID"), usuario);
    assert.equal(incompleta.status, 400);

    const sinSigla = await responderDiscoveryCatastro(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&via=GUAYANA-MOJONERA"),
      usuario
    );
    assert.equal(sinSigla.status, 400);
    const body = await leerJson(sinSigla);
    assert.equal(body.ok, false);
    assert.match(String(body.error), /sigla/i);
  });

  it("6. vía inexistente → 404", async () => {
    const client = mockClient({ viaInexistente: true, porNumero: {} });
    const response = await responderDiscoveryCatastro(requestDe(base), usuario, client);
    assert.equal(response.status, 404);
    const body = await leerJson(response);
    assert.equal(body.ok, false);
    assert.equal((body.error as { codigo: string }).codigo, "10");
  });

  it("7. error parcial → 200", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaError("11", "ERROR PARCIAL"),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });
    const response = await responderDiscoveryCatastro(requestDe(base), usuario, client);
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal(body.ok, true);
    const portals = body.portals as Array<{ number: string; processed: boolean; error: { codigo: string } | null }>;
    assert.equal(portals.find((item) => item.number === "5")?.processed, false);
    assert.equal(portals.find((item) => item.number === "5")?.error?.codigo, "11");
    assert.equal((body.fincas as unknown[]).length, 2);
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, false);
  });

  it("8. maxPortals acotado deja portalsFound intacto", async () => {
    const client = mockClient({
      portales: [{ numero: "1" }, { numero: "2" }, { numero: "3" }, { numero: "4" }],
      porNumero: {
        "1": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "1", ltp: ltpNo })]),
        "2": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "2", ltp: ltpNo })]),
        "3": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "3", ltp: ltpNo })]),
        "4": consultaOk([inmueble({ rc20: "444444444444440001AA", numero: "4", ltp: ltpNo })]),
      },
    });
    const response = await responderDiscoveryCatastro(
      requestDe(`${base}&maxPortals=2`),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const discovery = body.discovery as Record<string, unknown>;
    assert.equal(discovery.portalsFound, 4);
    assert.equal(discovery.portalsProcessed, 2);
    assert.equal(discovery.truncated, true);
    assert.equal(discovery.complete, false);
    assert.equal(discovery.completeCandidates, false);
  });

  it("9. concurrency inválida → 400 y la enorme se acota", async () => {
    const invalida = await responderDiscoveryCatastro(
      requestDe(`${base}&concurrency=0`),
      usuario
    );
    assert.equal(invalida.status, 400);

    const client = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });
    const enorme = await responderDiscoveryCatastro(
      requestDe(`${base}&concurrency=100`),
      usuario,
      client
    );
    assert.equal(enorme.status, 200);
  });

  it("10. complete = false si el WFS puede estar cortado", async () => {
    const client = mockClient({
      gmlAttrs: 'numberMatched="9000" numberReturned="3"',
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });
    const response = await responderDiscoveryCatastro(requestDe(base), usuario, client);
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    assert.equal((body.discovery as { complete: boolean; possibleCut: boolean }).complete, false);
    assert.equal((body.discovery as { possibleCut: boolean }).possibleCut, true);
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, false);
  });

  it("12. JSON estable y sin datos internos", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo }),
        ]),
      },
    });
    const response = await responderDiscoveryCatastro(requestDe(`${base}&numero=3`), usuario, client);
    const body = await leerJson(response);
    assert.deepEqual(Object.keys(body).sort(), ["discovery", "fincas", "ok", "portals", "query"]);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "raw"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "queryCatastro"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "fetches"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "cacheHits"), false);
    const query = body.query as Record<string, unknown>;
    assert.deepEqual(Object.keys(query).sort(), [
      "municipio",
      "numero",
      "postalCode",
      "provincia",
      "sigla",
      "via",
    ]);
    const discovery = body.discovery as Record<string, unknown>;
    assert.deepEqual(Object.keys(discovery).sort(), [
      "cobertura",
      "complete",
      "completeCandidates",
      "discoveryId",
      "hasNextPage",
      "limitation",
      "nextCursor",
      "page",
      "pageSize",
      "portalsFound",
      "portalsProcessed",
      "possibleCut",
      "source",
      "truncated",
    ]);
  });
});

describe("filtro horizontalDivision (salida)", () => {
  const ltpNo = "Parcela construida sin división horizontal";
  const ltpYes = "Parcela con varios inmuebles (division horizontal)";
  const ltpUnknown = "Parcela rústica sin edificar";
  const base = "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO";

  function clienteMixto(extra: { gmlAttrs?: string } = {}) {
    return mockClient({
      ...extra,
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
          inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "3", ltp: ltpNo }),
        ]),
        "5": consultaOk([inmueble({ rc20: "0751301VK4705B0001AA", numero: "5", ltp: ltpYes })]),
        "7": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "7", ltp: ltpUnknown })]),
      },
    });
  }

  async function refsDe(query: string, client = clienteMixto()) {
    const response = await responderDiscoveryCatastro(requestDe(query), usuario, client);
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const fincas = body.fincas as Array<{
      fincaReference: string;
      propertyReferences: string[];
      horizontalDivision: { status: string; reasonCode?: string };
    }>;
    return { body, fincas, refs: fincas.map((item) => item.fincaReference) };
  }

  it("7. filtro NO solo devuelve status NO", async () => {
    const { refs, fincas, body } = await refsDe(`${base}&horizontalDivision=NO`);
    assert.deepEqual(refs, ["AAAAAAAAAAAAAA"]);
    assert.ok(fincas.every((item) => item.horizontalDivision.status === "NO"));
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, false);
  });

  it("8. filtro YES solo devuelve status YES", async () => {
    const { refs, fincas } = await refsDe(`${base}&horizontalDivision=YES`);
    assert.deepEqual(refs, ["0751301VK4705B"]);
    assert.ok(fincas.every((item) => item.horizontalDivision.status === "YES"));
  });

  it("9. filtro UNKNOWN solo devuelve status UNKNOWN", async () => {
    const { refs, fincas } = await refsDe(`${base}&horizontalDivision=UNKNOWN`);
    assert.deepEqual(refs, ["CCCCCCCCCCCCCC"]);
    assert.ok(fincas.every((item) => item.horizontalDivision.status === "UNKNOWN"));
  });

  it("7. API expone reasonCode en UNKNOWN; el filtro no distingue motivos", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "MIXMIXMIXMIXMI0001AA", numero: "3", ltp: LTP_MIXTO_URBANO_RUSTICO }),
        ]),
        "5": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "5", ltp: ltpUnknown })]),
        "7": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "7", ltp: ltpNo })]),
      },
      portales: [{ numero: "3" }, { numero: "5" }, { numero: "7" }],
    });
    const { refs, fincas } = await refsDe(`${base}&horizontalDivision=UNKNOWN`, client);
    assert.deepEqual(refs.sort(), ["CCCCCCCCCCCCCC", "MIXMIXMIXMIXMI"]);
    const mixto = fincas.find((item) => item.fincaReference === "MIXMIXMIXMIXMI");
    const rustico = fincas.find((item) => item.fincaReference === "CCCCCCCCCCCCCC");
    assert.equal(mixto?.horizontalDivision.status, "UNKNOWN");
    assert.equal(mixto?.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
    assert.equal(rustico?.horizontalDivision.status, "UNKNOWN");
    assert.equal(rustico?.horizontalDivision.reasonCode, "LTP_UNRECOGNIZED");
    assert.equal(JSON.stringify(fincas).includes("xml"), false);
    assert.equal(JSON.stringify(fincas).includes("raw"), false);

    const sinLtp = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "NNNNNNNNNNNNNN0001AA", numero: "3" })]),
      },
      portales: [{ numero: "3" }],
      detalle: consultaOk([inmueble({ rc20: "NNNNNNNNNNNNNN0001AA", numero: "3" })]),
    });
    const ausente = await refsDe(`${base}&numero=3&horizontalDivision=UNKNOWN`, sinLtp);
    assert.equal(ausente.fincas[0]?.horizontalDivision.status, "UNKNOWN");
    assert.equal(ausente.fincas[0]?.horizontalDivision.reasonCode, "LTP_MISSING");
  });

  it("10. ALL equivale a omitir el parámetro", async () => {
    const omitido = await refsDe(base);
    const all = await refsDe(`${base}&horizontalDivision=ALL`);
    assert.deepEqual(omitido.refs, all.refs);
    assert.deepEqual(omitido.refs.sort(), ["0751301VK4705B", "AAAAAAAAAAAAAA", "CCCCCCCCCCCCCC"]);
  });

  it("12. filtro NOT_APPLICABLE; ALL incluye las cuatro categorías; NO no lo incluye", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "0751301VK4705B0001AA", numero: "5", ltp: ltpYes })]),
        "7": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "7", ltp: ltpUnknown })]),
        "2": consultaOk([
          inmueble({
            rc20: "5472105YJ0657S0001AA",
            numero: "2",
            uso: "Suelos sin edificar",
          }),
        ]),
      },
      portales: [{ numero: "3" }, { numero: "5" }, { numero: "7" }, { numero: "2" }],
    });
    const na = await refsDe(`${base}&horizontalDivision=NOT_APPLICABLE`, client);
    const no = await refsDe(`${base}&horizontalDivision=NO`, client);
    const all = await refsDe(`${base}&horizontalDivision=ALL`, client);
    assert.deepEqual(na.refs, ["5472105YJ0657S"]);
    assert.ok(na.fincas.every((item) => item.horizontalDivision.status === "NOT_APPLICABLE"));
    assert.deepEqual(no.refs, ["AAAAAAAAAAAAAA"]);
    assert.ok(no.fincas.every((item) => item.horizontalDivision.status === "NO"));
    assert.deepEqual(all.refs.sort(), [
      "0751301VK4705B",
      "5472105YJ0657S",
      "AAAAAAAAAAAAAA",
      "CCCCCCCCCCCCCC",
    ]);
  });

  it("4 y 5. error DNPRC → UNKNOWN; varias RC → una finca", async () => {
    const client = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" }),
          inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "3" }),
        ]),
      },
      portales: [{ numero: "3" }],
      detalle: consultaError("33", "ERROR Consulta_DNPRC"),
    });
    const { fincas, refs, body } = await refsDe(`${base}&numero=3`, client);
    assert.deepEqual(refs, ["AAAAAAAAAAAAAA"]);
    assert.equal(fincas[0]?.propertyReferences.length, 2);
    assert.equal(fincas[0]?.horizontalDivision.status, "UNKNOWN");
    assert.equal(fincas[0]?.horizontalDivision.reasonCode, "QUERY_ERROR");
    assert.equal((body.discovery as { completeCandidates: boolean }).completeCandidates, false);

    const filtrado = await refsDe(`${base}&numero=3&horizontalDivision=NO`, client);
    assert.deepEqual(filtrado.refs, []);
  });

  it("16. CP + horizontalDivision=NO no envía CP a Catastro", async () => {
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
      assert.equal(Object.prototype.hasOwnProperty.call(consulta, "cpos"), false);
      return original(consulta);
    };
    const { refs, body } = await refsDe(`${base}&postalCode=46388&horizontalDivision=NO`, client);
    assert.deepEqual(consultados, ["3", "5", "7"]);
    assert.deepEqual(refs, ["AAAAAAAAAAAAAA"]);
    assert.equal((body.portals as unknown[]).length, 3);
  });

  it("11, 12, 17 y 18. paginación + NO no duplica y no declara exhaustivo", async () => {
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
    const p1 = await responderDiscoveryCatastro(
      requestDe(`${base}&pageSize=2&horizontalDivision=NO`),
      usuario,
      client,
      store
    );
    const b1 = await leerJson(p1);
    const d1 = b1.discovery as {
      hasNextPage: boolean;
      completeCandidates: boolean;
      nextCursor: string;
      complete: boolean;
    };
    const f1 = b1.fincas as Array<{ fincaReference: string; portals: string[] }>;
    assert.equal(p1.status, 200);
    assert.equal(d1.hasNextPage, true);
    assert.equal(d1.complete, false);
    assert.equal(d1.completeCandidates, false);
    assert.deepEqual(
      f1.map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.deepEqual(f1[0]?.portals, ["10"]);

    const p2 = await responderDiscoveryCatastro(
      requestDe(`cursor=${encodeURIComponent(d1.nextCursor)}&horizontalDivision=NO`),
      usuario,
      client,
      store
    );
    const b2 = await leerJson(p2);
    const d2 = b2.discovery as {
      hasNextPage: boolean;
      completeCandidates: boolean;
      nextCursor: string;
      complete: boolean;
    };
    const f2 = b2.fincas as Array<{ fincaReference: string; portals: string[] }>;
    assert.equal(d2.hasNextPage, true);
    assert.equal(d2.completeCandidates, false);
    assert.deepEqual(
      f2.map((item) => item.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.deepEqual(f2[0]?.portals, ["10", "12"]);

    const p3 = await responderDiscoveryCatastro(
      requestDe(`cursor=${encodeURIComponent(d2.nextCursor)}&horizontalDivision=NO`),
      usuario,
      client,
      store
    );
    const b3 = await leerJson(p3);
    const d3 = b3.discovery as { hasNextPage: boolean; completeCandidates: boolean; complete: boolean };
    const f3 = b3.fincas as Array<{ fincaReference: string }>;
    assert.equal(d3.hasNextPage, false);
    assert.equal(d3.complete, true);
    assert.equal(d3.completeCandidates, true);
    assert.deepEqual(
      f3.map((item) => item.fincaReference),
      ["CCCCCCCCCCCCCC"]
    );
    const porIdentidad = new Map<string, { fincaReference: string; portals: string[] }>();
    for (const finca of [...f1, ...f2, ...f3]) {
      porIdentidad.set(finca.fincaReference, finca);
    }
    assert.equal(porIdentidad.size, 2);
    assert.deepEqual(porIdentidad.get("AAAAAAAAAAAAAA")?.portals, ["10", "12"]);
  });

  it("valor inválido → 400", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe(`${base}&horizontalDivision=TALVEZ`),
      usuario
    );
    assert.equal(response.status, 400);
  });
});

describe("GET /api/catastro/search discovery contra Catastro", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });

  it("A. Madrid CL Fuencarral 50 → 0751301VK4705B YES", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe("provincia=Madrid&municipio=Madrid&sigla=CL&via=Fuencarral&numero=50"),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const finca = (body.fincas as Array<Record<string, unknown>>)[0];
    assert.equal(finca?.fincaReference, "0751301VK4705B");
    assert.equal((finca?.horizontalDivision as { status: string }).status, "YES");
    assert.ok(((finca?.propertyReferences as string[]) ?? []).length > 1);
    assert.equal((finca?.address as { numero: string }).numero, "50");
    assert.deepEqual(finca?.postalCodes, ["28004"]);
    assert.equal(finca?.superficieSolar, 194);
    assert.ok(((finca?.properties as unknown[]) ?? []).length > 1);
  });

  it("B. Godelleta CL GUAYANA-MOJONERA 3 → 2749704YJ0624N NO", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3"
      ),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const finca = (body.fincas as Array<Record<string, unknown>>)[0];
    assert.equal(finca?.fincaReference, "2749704YJ0624N");
    assert.equal((finca?.horizontalDivision as { status: string }).status, "NO");
    assert.equal(finca?.postalCode, "46388");
    assert.deepEqual(finca?.postalCodes, ["46388"]);
    assert.equal((finca?.address as { numero: string }).numero, "3");
    assert.equal(finca?.superficieSolar, 839);
    assert.equal((finca?.properties as unknown[])?.length, 1);
  });

  it("Fase 8. Godelleta 3 + horizontalDivision=NO", async () => {
    const no = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3&horizontalDivision=NO"
      ),
      usuario,
      client
    );
    const yes = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3&horizontalDivision=YES"
      ),
      usuario,
      client
    );
    assert.equal(no.status, 200);
    const bodyNo = await leerJson(no);
    const fincasNo = bodyNo.fincas as Array<Record<string, unknown>>;
    assert.equal(fincasNo[0]?.fincaReference, "2749704YJ0624N");
    assert.equal((fincasNo[0]?.horizontalDivision as { status: string }).status, "NO");
    assert.equal((bodyNo.discovery as { completeCandidates: boolean }).completeCandidates, true);
    assert.equal(((await leerJson(yes)).fincas as unknown[]).length, 0);
  });

  it("Fase 8. Fuencarral 50 + horizontalDivision=NO no aparece", async () => {
    const no = await responderDiscoveryCatastro(
      requestDe(
        "provincia=Madrid&municipio=Madrid&sigla=CL&via=Fuencarral&numero=50&horizontalDivision=NO"
      ),
      usuario,
      client
    );
    const yes = await responderDiscoveryCatastro(
      requestDe(
        "provincia=Madrid&municipio=Madrid&sigla=CL&via=Fuencarral&numero=50&horizontalDivision=YES"
      ),
      usuario,
      client
    );
    assert.equal(no.status, 200);
    const refsNo = ((await leerJson(no)).fincas as Array<{ fincaReference: string }>).map(
      (item) => item.fincaReference
    );
    assert.ok(!refsNo.includes("0751301VK4705B"));
    const bodyYes = await leerJson(yes);
    const finca = (bodyYes.fincas as Array<Record<string, unknown>>)[0];
    assert.equal(finca?.fincaReference, "0751301VK4705B");
    assert.equal((finca?.horizontalDivision as { status: string }).status, "YES");
  });

  it("C. Godelleta sin número descubre 3, 5 y 7", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA"),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const portals = (body.portals as Array<{ number: string }>).map((item) => item.number);
    assert.deepEqual(portals, ["3", "5", "7"]);
    assert.equal((body.discovery as { complete: boolean }).complete, true);
  });

  it("Fase 8. Godelleta sin número + NO es exhaustivo", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&horizontalDivision=NO"
      ),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const refs = (body.fincas as Array<{ fincaReference: string; horizontalDivision: { status: string } }>)
      .map((item) => item.fincaReference);
    assert.ok(refs.includes("2749704YJ0624N"));
    assert.ok(
      (body.fincas as Array<{ horizontalDivision: { status: string } }>).every(
        (item) => item.horizontalDivision.status === "NO"
      )
    );
    assert.equal(typeof (body.discovery as { completeCandidates: boolean }).completeCandidates, "boolean");
  });

  it("D. vía inexistente → HTTP 404", async () => {
    const response = await responderDiscoveryCatastro(
      requestDe("provincia=MADRID&municipio=MADRID&sigla=CL&via=NOEXISTEXYZ&numero=1"),
      usuario,
      client
    );
    assert.equal(response.status, 404);
    const body = await leerJson(response);
    assert.equal(body.ok, false);
    assert.equal((body.error as { codigo: string }).codigo, "33");
  });

  it("3. filtro CP sobre Godelleta 3", async () => {
    const coincide = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3&postalCode=46388"
      ),
      usuario,
      client
    );
    const noCoincide = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3&postalCode=28004"
      ),
      usuario,
      client
    );
    assert.equal(coincide.status, 200);
    assert.equal(noCoincide.status, 200);
    assert.equal(((await leerJson(coincide)).fincas as unknown[]).length, 1);
    const body = await leerJson(noCoincide);
    assert.equal((body.fincas as unknown[]).length, 0);
    assert.equal((body.portals as unknown[]).length, 1);
  });

  it("11. cache: la repetición no incrementa fetches", async () => {
    const antes = client.getStats();
    const response = await responderDiscoveryCatastro(
      requestDe(
        "provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA&numero=3"
      ),
      usuario,
      client
    );
    assert.equal(response.status, 200);
    const despues = client.getStats();
    assert.ok(despues.cacheHits > antes.cacheHits);
    assert.equal(despues.fetches, antes.fetches);
  });
});
