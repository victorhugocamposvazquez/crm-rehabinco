import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient, type CatastroClient } from "./client";
import { createDiscoveryStore } from "./discovery-session";
import { discoverFincas } from "./discovery";
import { LTP_MIXTO_URBANO_RUSTICO } from "./unknown-reason";
import { esReferenciaFinca, esReferenciaInmueble } from "./references";
import { hayCorteWfs, numerosOficiales, parsearDireccionesInspire } from "./inspire-ad";
import type {
  ConsultaDireccion,
  ConsultaReferencia,
  DireccionNormalizada,
  InmuebleNormalizado,
  ResultadoConsultaCatastro,
} from "./types";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";

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
  items: Array<{ numero: string; parcela?: string; cp?: string }>,
  attrs = ""
): string {
  const miembros = items
    .map((item) => {
      const localId = item.parcela
        ? `46.138.57.${item.numero}.${item.parcela}`
        : `46.138.57.${item.numero}`;
      const postal = item.cp
        ? `<ad:component xlink:href="#ES.SDGC.PD.46.138.${item.cp}" />`
        : "";
      return `<gml:featureMember>
        <ad:Address>
          <base:localId>${localId}</base:localId>
          <ad:LocatorDesignator><ad:designator>${item.numero}</ad:designator></ad:LocatorDesignator>
          ${postal}
        </ad:Address>
      </gml:featureMember>`;
    })
    .join("");
  return `<gml:FeatureCollection ${attrs}>${miembros}</gml:FeatureCollection>`;
}

function inmueble(opts: {
  rc20: string;
  numero: string;
  numero2?: string;
  cp?: string;
  ltp?: string;
  literal?: string;
  uso?: string;
  superficieSolar?: number;
}): InmuebleNormalizado {
  const rc14 = opts.rc20.slice(0, 14);
  return {
    referenciaCatastral: opts.rc20,
    referenciaParcela: rc14,
    cargo: opts.rc20.slice(14, 18),
    tipoBien: "UR",
    direccion: {
      ...DIR_VACIA,
      tipoVia: "CL",
      via: "DEMO",
      numero: opts.numero,
      numero2: opts.numero2 ?? null,
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
      ? {
          literal: null,
          tipoLiteral: opts.ltp,
          superficieSolar: opts.superficieSolar ?? null,
          urlGrafico: null,
        }
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
    raw: { ok: true },
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
    raw: { error: true },
  };
}

function catalogo(municipio: string, via: string, sigla = "CL") {
  return {
    municipios: {
      consulta_municipieroResult: {
        municipiero: { muni: [{ locat: { cd: "46", cmc: "138" }, nm: municipio }] },
      },
    },
    callejero: {
      consulta_callejeroResult: {
        callejero: { calle: [{ dir: { cv: "57", tv: sigla, nv: via } }] },
      },
    },
  };
}

function mockClient(opts: {
  portales?: Array<{ numero: string; parcela?: string; cp?: string }>;
  gmlAttrs?: string;
  porNumero: Record<string, ResultadoConsultaCatastro | Error>;
  detalle?: ResultadoConsultaCatastro | ((ref: string) => ResultadoConsultaCatastro);
  viaInexistente?: boolean;
}): { client: CatastroClient; counters: { dnploc: number; dnprc: number; maxInFlight: number } } {
  const counters = { dnploc: 0, dnprc: 0, maxInFlight: 0, inFlight: 0 };
  const datos = catalogo("GODELLETA", "DEMO");
  const portales = opts.portales ?? [{ numero: "3" }, { numero: "5" }, { numero: "7" }];

  const client = {
    consultarDireccion: async (consulta: ConsultaDireccion) => {
      counters.dnploc += 1;
      counters.inFlight += 1;
      counters.maxInFlight = Math.max(counters.maxInFlight, counters.inFlight);
      try {
        const respuesta = opts.porNumero[consulta.numero];
        if (respuesta instanceof Error) throw respuesta;
        if (!respuesta) throw new Error(`sin mock para portal ${consulta.numero}`);
        return respuesta;
      } finally {
        counters.inFlight -= 1;
      }
    },
    consultarReferencia: async (consulta: ConsultaReferencia) => {
      counters.dnprc += 1;
      if (typeof opts.detalle === "function") return opts.detalle(consulta.refCat);
      if (opts.detalle) return opts.detalle;
      throw new Error("Consulta_DNPRC no mockeada");
    },
    consultarPoligonoParcela: async () => {
      throw new Error("no usado");
    },
    obtenerProvincias: async () => {
      throw new Error("no usado");
    },
    obtenerMunicipios: async () => datos.municipios,
    obtenerCallejero: async () =>
      opts.viaInexistente
        ? {
            consulta_callejeroResult: {
              control: { cuerr: 1 },
              lerr: { err: [{ cod: "10", des: "NO HAY COINCIDENCIAS EN LA BÚSQUEDA DE VÍAS" }] },
            },
          }
        : datos.callejero,
    obtenerNumerero: async () => {
      throw new Error("no usado");
    },
    obtenerDireccionesPorCodigoVia: async () => gmlPortales(portales, opts.gmlAttrs),
    getStats: () => ({ fetches: 0, cacheHits: 0 }),
  } as CatastroClient;

  return { client, counters };
}

describe("parsearDireccionesInspire", () => {
  it("extrae portales oficiales del GML AD y no inventa una serie", () => {
    const gml = `
      <gml:featureMember>
        <ad:Address>
          <base:localId>46.138.57.3.2749704YJ0624N</base:localId>
          <ad:locator>
            <ad:AddressLocator>
              <ad:designator>
                <ad:LocatorDesignator>
                  <ad:designator>3</ad:designator>
                  <ad:type>1</ad:type>
                </ad:LocatorDesignator>
              </ad:designator>
            </ad:AddressLocator>
          </ad:locator>
          <ad:component xlink:href="#ES.SDGC.PD.46.138.46388" />
        </ad:Address>
      </gml:featureMember>
      <gml:featureMember>
        <ad:Address>
          <base:localId>46.138.57.5.2749703YJ0624N</base:localId>
          <ad:locator>
            <ad:AddressLocator>
              <ad:designator>
                <ad:LocatorDesignator>
                  <ad:designator>5</ad:designator>
                </ad:LocatorDesignator>
              </ad:designator>
            </ad:AddressLocator>
          </ad:locator>
        </ad:Address>
      </gml:featureMember>`;
    const parsed = parsearDireccionesInspire(gml);
    assert.deepEqual(numerosOficiales(parsed.direcciones), ["3", "5"]);
    assert.equal(parsed.direcciones[0]?.referenciaParcela, "2749704YJ0624N");
    assert.equal(parsed.posibleCorte, false);
  });

  it("marca possibleCut si numberMatched > numberReturned", () => {
    const gml = gmlPortales([{ numero: "3" }], 'numberMatched="9000" numberReturned="3"');
    assert.equal(hayCorteWfs(gml, 3), true);
    assert.equal(parsearDireccionesInspire(gml).posibleCorte, true);
  });
});

describe("discoverFincas — unidad", () => {
  const query = {
    provincia: "VALENCIA",
    municipio: "GODELLETA",
    sigla: "CL",
    via: "DEMO",
  };

  const ltpNo = "Parcela construida sin división horizontal";
  const ltpYes = "Parcela con varios inmuebles (division horizontal)";

  it("1. 3 portales → 1 finca", async () => {
    const { client } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" })]),
        "5": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "5" })]),
        "7": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0003CC", numero: "7" })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
      ]),
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 1);
    assert.equal(result.fincas[0]?.fincaReference, "AAAAAAAAAAAAAA");
    assert.deepEqual(result.fincas[0]?.portals, ["3", "5", "7"]);
    assert.equal(result.discovery.portalsFound, 3);
    assert.equal(result.discovery.complete, true);
  });

  it("2. 3 portales → 3 fincas", async () => {
    const { client } = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo }),
        ]),
        "5": consultaOk([
          inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpYes }),
        ]),
        "7": consultaOk([
          inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo }),
        ]),
      },
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 3);
    assert.deepEqual(
      result.fincas.map((finca) => finca.fincaReference),
      ["11111111111111", "22222222222222", "33333333333333"]
    );
  });

  it("3. varias RC → una sola finca", async () => {
    const { client, counters } = mockClient({
      portales: [{ numero: "50" }],
      porNumero: {
        "50": consultaOk([
          inmueble({ rc20: "0751301VK4705B0002OI", numero: "50" }),
          inmueble({ rc20: "0751301VK4705B0003PO", numero: "50" }),
          inmueble({ rc20: "0751301VK4705B0004AP", numero: "50" }),
        ]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "0751301VK4705B0002OI", numero: "50", ltp: ltpYes }),
      ]),
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 1);
    assert.equal(result.fincas[0]?.fincaReference, "0751301VK4705B");
    assert.equal(result.fincas[0]?.propertyReferences.length, 3);
    assert.equal(counters.dnprc, 1);
  });

  it("4 y 5. misma finca desde varios portales y una sola Consulta_DNPRC", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" })]),
        "5": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "5" })]),
        "7": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0003CC", numero: "7" })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
      ]),
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 1);
    assert.deepEqual(result.fincas[0]?.portals, ["3", "5", "7"]);
    assert.equal(counters.dnprc, 1);
  });

  it("6. maxPortals no finge el recuento oficial", async () => {
    const { client, counters } = mockClient({
      portales: [
        { numero: "1" },
        { numero: "2" },
        { numero: "3" },
        { numero: "4" },
      ],
      porNumero: {
        "1": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "1", ltp: ltpNo })]),
        "2": consultaOk([inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "2", ltp: ltpNo })]),
        "3": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "3", ltp: ltpNo })]),
        "4": consultaOk([inmueble({ rc20: "DDDDDDDDDDDDDD0001AA", numero: "4", ltp: ltpNo })]),
      },
    });

    const result = await discoverFincas(query, client, { maxPortals: 2 });
    assert.equal(result.discovery.portalsFound, 4);
    assert.equal(result.discovery.portalsProcessed, 2);
    assert.equal(result.discovery.truncated, true);
    assert.equal(result.discovery.complete, false);
    assert.equal(result.portals.length, 4);
    assert.equal(result.portals.filter((item) => item.skipReason === "maxPortals").length, 2);
    assert.equal(counters.dnploc, 2);
  });

  it("7. concurrency no dispara todas las consultas a la vez", async () => {
    const { client, counters } = mockClient({
      portales: [{ numero: "1" }, { numero: "2" }, { numero: "3" }, { numero: "4" }],
      porNumero: {
        "1": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "1", ltp: ltpNo })]),
        "2": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "2", ltp: ltpNo })]),
        "3": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "3", ltp: ltpNo })]),
        "4": consultaOk([inmueble({ rc20: "444444444444440001AA", numero: "4", ltp: ltpNo })]),
      },
    });

    const original = client.consultarDireccion;
    let enCurso = 0;
    let maxEnCurso = 0;
    client.consultarDireccion = async (consulta) => {
      enCurso += 1;
      maxEnCurso = Math.max(maxEnCurso, enCurso);
      try {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return original(consulta);
      } finally {
        enCurso -= 1;
      }
    };

    await discoverFincas(query, client, { concurrency: 2 });
    assert.ok(maxEnCurso <= 2);
    assert.equal(maxEnCurso, 2);
    assert.equal(counters.dnploc, 4);
  });

  it("8. error parcial de un portal no tumba la calle", async () => {
    const { client } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaError("11", "ERROR PARCIAL DE PRUEBA"),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.error, null);
    assert.equal(result.discovery.complete, true);
    assert.equal(result.fincas.length, 2);
    const fallido = result.portals.find((item) => item.number === "5");
    assert.equal(fallido?.processed, false);
    assert.equal(fallido?.error?.codigo, "11");
    assert.equal(result.portals.filter((item) => item.processed).length, 2);
  });

  it("9. possibleCut = true implica complete = false", async () => {
    const { client } = mockClient({
      gmlAttrs: 'numberMatched="9000" numberReturned="3"',
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.discovery.possibleCut, true);
    assert.equal(result.discovery.complete, false);
    assert.equal(result.discovery.portalsFound, 3);
    assert.equal(result.fincas.length, 3);
    assert.match(result.discovery.limitation ?? "", /no se puede afirmar/i);
  });

  it("10. filtro CP no elimina portales; el prefiltro evita DNPRC de fincas ajenas", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "111111111111110001AA", numero: "3", cp: "46388" }),
        ]),
        "5": consultaOk([
          inmueble({ rc20: "222222222222220001AA", numero: "5", cp: "28004" }),
        ]),
        "7": consultaOk([
          inmueble({ rc20: "333333333333330001AA", numero: "7", cp: "46388" }),
        ]),
      },
      detalle: (ref) =>
        consultaOk([
          inmueble({
            rc20: ref.padEnd(20, "A"),
            numero: "3",
            ltp: ltpNo,
          }),
        ]),
    });

    const result = await discoverFincas({ ...query, postalCode: "46388" }, client);
    assert.equal(result.portals.length, 3);
    assert.equal(result.portals.filter((item) => item.processed).length, 3);
    assert.equal(result.fincas.length, 2);
    assert.ok(result.fincas.every((finca) => finca.postalCode === "46388"));
    assert.equal(counters.dnploc, 3);
    assert.equal(counters.dnprc, 2);
    assert.equal(result.prefilter.dnprcAvoidedByPostalCode, 1);
    assert.equal(result.prefilter.fincasPotentiallyMatchingPostalCode, 2);
  });

  it("16. regresión: finca mixta se procesa; finca ajena no; una sola DNPRC", async () => {
    const { client, counters } = mockClient({
      portales: [{ numero: "3" }],
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", cp: "46388" }),
          inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "3", cp: "28004" }),
          inmueble({ rc20: "BBBBBBBBBBBBBB0001CC", numero: "3", cp: "28004" }),
        ]),
      },
      detalle: (ref) =>
        consultaOk([
          inmueble({
            rc20: ref.padEnd(20, "A"),
            numero: "3",
            ltp: ltpNo,
          }),
        ]),
    });

    const result = await discoverFincas({ ...query, numero: "3", postalCode: "46388" }, client);
    assert.deepEqual(
      result.fincas.map((finca) => finca.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.deepEqual(result.fincas[0]?.propertyReferences, [
      "AAAAAAAAAAAAAA0001AA",
      "AAAAAAAAAAAAAA0002BB",
    ]);
    assert.deepEqual(result.fincas[0]?.postalCodes, ["28004", "46388"]);
    assert.equal(counters.dnprc, 1);
    assert.equal(result.prefilter.dnprcAvoidedByPostalCode, 1);
    assert.equal(result.prefilter.propertiesRejectedByPostalCode, 2);
    assert.equal(result.prefilter.fincasPotentiallyMatchingPostalCode, 1);
  });

  it("16b. CP ausente en DNPLOC no se descarta antes de ltp", async () => {
    const { client, counters } = mockClient({
      portales: [{ numero: "3" }],
      porNumero: {
        "3": consultaOk([
          {
            ...inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" }),
            direccion: {
              ...inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" }).direccion,
              codigoPostal: null,
            },
          },
        ]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
      ]),
    });
    const result = await discoverFincas({ ...query, numero: "3", postalCode: "46388" }, client);
    assert.equal(counters.dnprc, 1);
    assert.equal(result.prefilter.dnprcAvoidedByPostalCode, 0);
    assert.equal(result.prefilter.fincasPotentiallyMatchingPostalCode, 1);
  });

  it("12b. sin CP se resuelve ltp de todas las fincas (comportamiento antiguo)", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", cp: "46388" })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", cp: "28004" })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", cp: "46388" })]),
      },
      detalle: (ref) =>
        consultaOk([inmueble({ rc20: ref.padEnd(20, "A"), numero: "3", ltp: ltpNo })]),
    });
    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 3);
    assert.equal(counters.dnprc, 3);
    assert.equal(result.prefilter.dnprcAvoidedByPostalCode, 0);
    assert.equal(result.prefilter.propertiesRejectedByPostalCode, 0);
  });

  it("11. discovery repetido reutiliza la cache de ltp", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" })]),
        "5": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "5" })]),
        "7": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0003CC", numero: "7" })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
      ]),
    });

    await discoverFincas(query, client);
    const dnprcTrasPrimera = counters.dnprc;
    await discoverFincas(query, client);
    assert.equal(dnprcTrasPrimera, 1);
    assert.equal(counters.dnprc, 1);
    assert.equal(counters.dnploc, 6);
  });

  it("5. ltp presente en DNPLOC no dispara DNPRC", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({
            rc20: "AAAAAAAAAAAAAA0001AA",
            numero: "3",
            ltp: ltpNo,
            superficieSolar: 120,
          }),
        ]),
      },
      portales: [{ numero: "3" }],
    });
    const result = await discoverFincas({ ...query, numero: "3" }, client);
    assert.equal(counters.dnprc, 0);
    assert.equal(result.fincas[0]?.ltp, ltpNo);
    assert.equal(result.fincas[0]?.superficieSolar, 120);
    assert.equal(result.fincas[0]?.address.numero, "3");
  });

  it("suelo oficial en DNPLOC → NOT_APPLICABLE sin DNPRC", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "2": consultaOk([
          inmueble({
            rc20: "5472105YJ0657S0001AA",
            numero: "2",
            uso: "Obras de urbanización y jardineria, suelos sin edificar",
            literal: "CL DEMO 2 Suelo 46388 GODELLETA (VALENCIA)",
          }),
        ]),
      },
      portales: [{ numero: "2" }],
    });
    const result = await discoverFincas({ ...query, numero: "2" }, client);
    assert.equal(counters.dnprc, 0);
    assert.equal(result.fincas[0]?.horizontalDivision.status, "NOT_APPLICABLE");
    assert.notEqual(result.fincas[0]?.horizontalDivision.status, "NO");
  });

  it("suelo solo en DNPRC → NOT_APPLICABLE; residencial sin ltp sigue UNKNOWN", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "2": consultaOk([inmueble({ rc20: "5472105YJ0657S0001AA", numero: "2" })]),
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" })]),
      },
      portales: [{ numero: "2" }, { numero: "3" }],
      detalle: (ref) => {
        if (ref.startsWith("5472105YJ0657S")) {
          return consultaOk([
            inmueble({
              rc20: ref.padEnd(20, "A"),
              numero: "2",
              uso: "Suelos sin edificar",
            }),
          ]);
        }
        return consultaOk([inmueble({ rc20: ref.padEnd(20, "A"), numero: "3" })]);
      },
    });
    const result = await discoverFincas(query, client);
    const suelo = result.fincas.find((item) => item.fincaReference === "5472105YJ0657S");
    const residencial = result.fincas.find((item) => item.fincaReference === "AAAAAAAAAAAAAA");
    assert.equal(counters.dnprc, 2);
    assert.equal(suelo?.horizontalDivision.status, "NOT_APPLICABLE");
    assert.equal(residencial?.horizontalDivision.status, "UNKNOWN");
    assert.equal(residencial?.horizontalDivision.reasonCode, "LTP_MISSING");
  });

  it("8-9. misma finca y cache no cambian el reasonCode", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({
            rc20: "AAAAAAAAAAAAAA0001AA",
            numero: "3",
            ltp: LTP_MIXTO_URBANO_RUSTICO,
          }),
        ]),
      },
      portales: [{ numero: "3" }],
    });
    const primera = await discoverFincas({ ...query, numero: "3" }, client);
    const segunda = await discoverFincas({ ...query, numero: "3" }, client);
    assert.equal(primera.fincas[0]?.horizontalDivision.status, "UNKNOWN");
    assert.equal(primera.fincas[0]?.horizontalDivision.reasonCode, "MIXED_URBAN_RURAL");
    assert.equal(segunda.fincas[0]?.horizontalDivision.status, primera.fincas[0]?.horizontalDivision.status);
    assert.equal(
      segunda.fincas[0]?.horizontalDivision.reasonCode,
      primera.fincas[0]?.horizontalDivision.reasonCode
    );
    assert.equal(counters.dnprc, 0);
  });

  it("6. cache de ltp se reutiliza entre sesiones distintas", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3" })]),
        "5": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "5" })]),
        "7": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0003CC", numero: "7" })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "3", ltp: ltpNo }),
      ]),
    });
    await discoverFincas(query, client, { paginated: true, store: createDiscoveryStore() });
    assert.equal(counters.dnprc, 1);
    await discoverFincas(query, client, { paginated: true, store: createDiscoveryStore() });
    assert.equal(counters.dnprc, 1);
  });

  it("9. cache de ltp no cambia el reasonCode de UNKNOWN", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "3" })]),
      },
      portales: [{ numero: "3" }],
      detalle: consultaOk([
        inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "3", ltp: "Parcela rústica sin edificar" }),
      ]),
    });
    const primera = await discoverFincas({ ...query, numero: "3" }, client);
    const segunda = await discoverFincas({ ...query, numero: "3" }, client);
    assert.equal(primera.fincas[0]?.horizontalDivision.status, "UNKNOWN");
    assert.equal(primera.fincas[0]?.horizontalDivision.reasonCode, "LTP_UNRECOGNIZED");
    assert.equal(segunda.fincas[0]?.horizontalDivision.reasonCode, "LTP_UNRECOGNIZED");
    assert.equal(counters.dnprc, 1);
  });

  it("8. conserva numeración oficial 10A / 10-BIS", async () => {
    const { client } = mockClient({
      portales: [{ numero: "10A" }, { numero: "10-BIS" }],
      porNumero: {
        "10A": consultaOk([
          inmueble({
            rc20: "AAAAAAAAAAAAAA0001AA",
            numero: "10A",
            ltp: ltpNo,
            literal: "CL DEMO 10A",
          }),
        ]),
        "10-BIS": consultaOk([
          inmueble({
            rc20: "BBBBBBBBBBBBBB0001AA",
            numero: "10",
            numero2: "BIS",
            ltp: ltpNo,
            literal: "CL DEMO 10-BIS",
          }),
        ]),
      },
    });
    const result = await discoverFincas(query, client);
    const refs = result.portals.map((item) => item.number);
    assert.ok(refs.includes("10A"));
    assert.ok(refs.includes("10-BIS"));
    const diezA = result.fincas.find((item) => item.address.numero === "10A");
    const diezBis = result.fincas.find((item) => item.address.numero2 === "BIS");
    assert.equal(diezA?.address.numero, "10A");
    assert.equal(diezBis?.address.numero, "10");
    assert.equal(diezBis?.address.numero2, "BIS");
  });

  it("9. varios CP oficiales en la misma finca se conservan", async () => {
    const { client } = mockClient({
      portales: [{ numero: "10" }, { numero: "12" }],
      porNumero: {
        "10": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", cp: "46388", ltp: ltpNo }),
        ]),
        "12": consultaOk([
          inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12", cp: "28004", ltp: ltpNo }),
        ]),
      },
    });
    const result = await discoverFincas(query, client);
    assert.equal(result.fincas.length, 1);
    assert.deepEqual(result.fincas[0]?.postalCodes, ["28004", "46388"]);
    const filtrado = await discoverFincas({ ...query, postalCode: "28004" }, client);
    assert.equal(filtrado.fincas.length, 1);
    assert.ok(filtrado.fincas[0]?.postalCodes.includes("28004"));
  });

  it("12. calle inexistente → error oficial de base", async () => {
    const { client } = mockClient({
      viaInexistente: true,
      porNumero: {},
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.discovery.cobertura, "no-disponible");
    assert.equal(result.discovery.complete, false);
    assert.equal(result.error?.codigo, "10");
    assert.equal(result.portals.length, 0);
    assert.equal(result.fincas.length, 0);
  });

  it("13. número concreto consulta solo ese portal", async () => {
    const { client, counters } = mockClient({
      porNumero: {
        "3": consultaOk([
          inmueble({ rc20: "2749704YJ0624N0001DI", numero: "3", ltp: ltpNo }),
        ]),
      },
    });

    const result = await discoverFincas({ ...query, numero: "3" }, client);
    assert.equal(result.discovery.source, "DNPLOC");
    assert.equal(result.discovery.portalsFound, 1);
    assert.equal(result.fincas[0]?.fincaReference, "2749704YJ0624N");
    assert.equal(counters.dnploc, 1);
  });

  it("14. sin número usa INSPIRE y conserva todos los portales", async () => {
    const { client } = mockClient({
      porNumero: {
        "3": consultaOk([inmueble({ rc20: "111111111111110001AA", numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: "222222222222220001AA", numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: "333333333333330001AA", numero: "7", ltp: ltpNo })]),
      },
    });

    const result = await discoverFincas(query, client);
    assert.equal(result.discovery.source, "INSPIRE_AD");
    assert.deepEqual(result.numerosOficiales, ["3", "5", "7"]);
    assert.equal(result.portals.length, 3);
    assert.ok(result.portals.every((item) => item.processed));
  });
});

describe("discoverFincas", { skip: skipLive }, () => {
  const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });

  it("Caso A: Godelleta 3 → finca 2749704YJ0624N y DH NO", async () => {
    const result = await discoverFincas(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
      },
      client
    );

    assert.equal(result.error, null);
    assert.equal(result.cobertura, "numero");
    assert.equal(result.discovery.source, "DNPLOC");
    assert.equal(result.discovery.complete, true);
    assert.equal(result.portals[0]?.number, "3");
    assert.equal(result.fincas.length, 1);
    assert.equal(result.fincas[0]?.fincaReference, "2749704YJ0624N");
    assert.deepEqual(result.fincas[0]?.portals, ["3"]);
    assert.ok(result.fincas[0]?.propertyReferences.includes("2749704YJ0624N0001DI"));
    assert.equal(result.fincas[0]?.horizontalDivision.status, "NO");
    assert.equal(result.fincas[0]?.horizontalDivision.confidence, 1);
    assert.equal(result.fincas[0]?.ltp, "Parcela construida sin división horizontal");
    assert.equal(result.fincas[0]?.postalCode, "46388");
    assert.deepEqual(result.fincas[0]?.postalCodes, ["46388"]);
    assert.equal(result.fincas[0]?.address.numero, "3");
    assert.equal(result.fincas[0]?.superficieSolar, 839);
    assert.equal(result.fincas[0]?.properties.length, 1);
    assert.equal(result.fincas[0]?.properties[0]?.superficie, 94);
    assert.equal(result.fincas[0]?.properties[0]?.anio, 1976);
    assert.equal(result.fincas[0]?.properties[0]?.uso, "Residencial");
    assert.ok(esReferenciaFinca(result.fincas[0]?.fincaReference));
    assert.ok(result.fincas[0]?.propertyReferences.every(esReferenciaInmueble));
    assert.equal(Object.prototype.hasOwnProperty.call(result.fincas[0], "coordenadas"), false);
  });

  it("Caso B: Fuencarral 50 → finca 0751301VK4705B y DH YES", async () => {
    const result = await discoverFincas(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
        numero: "50",
      },
      client
    );

    assert.equal(result.error, null);
    assert.equal(result.fincas.length, 1);
    assert.equal(result.fincas[0]?.fincaReference, "0751301VK4705B");
    assert.ok((result.fincas[0]?.propertyReferences.length ?? 0) > 1);
    assert.deepEqual(result.fincas[0]?.portals, ["50"]);
    assert.equal(result.fincas[0]?.horizontalDivision.status, "YES");
    assert.equal(result.fincas[0]?.ltp, "Parcela con varios inmuebles (division horizontal)");
    assert.equal(result.fincas[0]?.address.numero, "50");
    assert.deepEqual(result.fincas[0]?.postalCodes, ["28004"]);
    assert.ok((result.fincas[0]?.properties.length ?? 0) > 1);
    assert.ok(result.fincas[0]?.properties.every((item) => item.reference.length === 20));
    assert.equal(result.fincas[0]?.superficieSolar, 194);
    assert.ok(esReferenciaFinca(result.fincas[0]?.fincaReference));
  });

  it("Caso C: vía inexistente → error oficial de Catastro", async () => {
    const result = await discoverFincas(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "NOEXISTEXYZ",
        numero: "1",
      },
      client
    );

    assert.equal(result.fincas.length, 0);
    assert.equal(result.error?.codigo, "33");
    assert.equal(result.portals[0]?.processed, false);
    assert.match(result.error?.descripcion ?? "", /VÍA NO EXISTE/i);
  });

  it("filtra por código postal después de Catastro, sin enviarlo a la API", async () => {
    const coincide = await discoverFincas(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
        codigoPostal: "46388",
      },
      client
    );
    const noCoincide = await discoverFincas(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
        codigoPostal: "28004",
      },
      client
    );

    assert.equal(coincide.fincas.length, 1);
    assert.equal(noCoincide.fincas.length, 0);
    assert.equal(noCoincide.portals.length, 1);
    assert.equal(noCoincide.portals[0]?.processed, true);
  });

  it("sin número usa GetADByCodVIA y no inventa portales 1,2,3…", async () => {
    const result = await discoverFincas(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
      },
      client
    );

    assert.equal(result.cobertura, "via-oficial");
    assert.equal(result.discovery.source, "INSPIRE_AD");
    assert.equal(result.discovery.complete, true);
    assert.equal(result.discovery.truncated, false);
    assert.equal(result.discovery.possibleCut, false);
    assert.deepEqual(result.numerosOficiales, ["3", "5", "7"]);
    assert.ok(!result.numerosOficiales.includes("1"));
    assert.ok(!result.numerosOficiales.includes("2"));
    assert.equal(result.portals.length, 3);
    assert.ok(result.portals.every((item) => item.processed));
    assert.ok(result.fincas.some((finca) => finca.fincaReference === "2749704YJ0624N"));
    assert.equal(
      result.fincas.find((finca) => finca.fincaReference === "2749704YJ0624N")
        ?.horizontalDivision.status,
      "NO"
    );
  });

  it("sin número y vía inexistente → error oficial del callejero", async () => {
    const result = await discoverFincas(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "NOEXISTEXYZ",
      },
      client
    );

    assert.equal(result.cobertura, "no-disponible");
    assert.equal(result.fincas.length, 0);
    assert.equal(result.error?.codigo, "10");
    assert.match(result.error?.descripcion ?? "", /NO HAY COINCIDENCIAS/i);
  });

  it("discovery repetido de Godelleta 3 usa cache HTTP", async () => {
    const antes = client.getStats();
    await discoverFincas(
      {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
      },
      client
    );
    const despues = client.getStats();
    assert.ok(despues.cacheHits > antes.cacheHits);
    assert.equal(despues.fetches, antes.fetches);
  });

  it("calle grande: metadatos de truncamiento sin martillar Catastro", async () => {
    const largo = createCatastroClient({
      minIntervalMs: 400,
      cacheTtlMs: 60_000,
      timeoutMs: 90_000,
    });
    const result = await discoverFincas(
      {
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
      },
      largo,
      { maxPortals: 3, concurrency: 2 }
    );

    assert.equal(result.discovery.source, "INSPIRE_AD");
    assert.ok(result.discovery.portalsFound > 40);
    assert.equal(result.discovery.portalsProcessed, 3);
    assert.equal(result.discovery.truncated, true);
    assert.equal(result.discovery.complete, false);
    assert.equal(result.portals.length, result.discovery.portalsFound);
    assert.equal(result.portals.filter((item) => item.skipReason === "maxPortals").length, result.discovery.portalsFound - 3);
    assert.equal(result.error, null);
  });
});
