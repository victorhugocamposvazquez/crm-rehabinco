import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatastroClient, type CatastroClient } from "./client";
import { API_MAX_PORTALS } from "./constants";
import { discoverFincas } from "./discovery";
import { createDiscoveryStore } from "./discovery-session";
import { parsearDiscovery, responderDiscoveryCatastro } from "./search-discovery";
import type {
  ConsultaDireccion,
  ConsultaReferencia,
  DireccionNormalizada,
  InmuebleNormalizado,
  ResultadoConsultaCatastro,
} from "./types";

const skipLive = process.env.CATASTRO_SKIP_LIVE === "1";
const usuario = { id: "fase7-test" };
const ltpNo = "Parcela construida sin división horizontal";

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

function gmlPortales(numeros: string[], attrs = ""): string {
  const miembros = numeros
    .map(
      (numero) => `<gml:featureMember>
        <ad:Address>
          <base:localId>46.138.57.${numero}</base:localId>
          <ad:LocatorDesignator><ad:designator>${numero}</ad:designator></ad:LocatorDesignator>
        </ad:Address>
      </gml:featureMember>`
    )
    .join("");
  return `<gml:FeatureCollection ${attrs}>${miembros}</gml:FeatureCollection>`;
}

function inmueble(opts: { rc20: string; numero: string; ltp?: string }): InmuebleNormalizado {
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
      codigoPostal: "46388",
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

function rcDe(indice: number, finca = indice): string {
  const parcela = String(finca).padStart(14, "1");
  const cargo = String(indice).padStart(4, "0");
  return `${parcela}${cargo}AA`;
}

function mockPaginado(opts: {
  numeros: string[];
  gmlAttrs?: string;
  porNumero: Record<string, ResultadoConsultaCatastro>;
  detalle?: ResultadoConsultaCatastro;
}): { client: CatastroClient; counters: { inspire: number; dnploc: number; dnprc: number } } {
  const counters = { inspire: 0, dnploc: 0, dnprc: 0 };
  const client = {
    consultarDireccion: async (consulta: ConsultaDireccion) => {
      counters.dnploc += 1;
      const respuesta = opts.porNumero[consulta.numero];
      if (!respuesta) throw new Error(`sin mock para ${consulta.numero}`);
      return respuesta;
    },
    consultarReferencia: async (_consulta: ConsultaReferencia) => {
      counters.dnprc += 1;
      return (
        opts.detalle ??
        consultaOk([inmueble({ rc20: rcDe(1), numero: "1", ltp: ltpNo })])
      );
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
    obtenerCallejero: async () => ({
      consulta_callejeroResult: {
        callejero: { calle: [{ dir: { cv: "57", tv: "CL", nv: "DEMO" } }] },
      },
    }),
    obtenerNumerero: async () => {
      throw new Error("no usado");
    },
    obtenerDireccionesPorCodigoVia: async () => {
      counters.inspire += 1;
      return gmlPortales(opts.numeros, opts.gmlAttrs);
    },
    getStats: () => ({ fetches: 0, cacheHits: 0 }),
  } as CatastroClient;
  return { client, counters };
}

const query = {
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  sigla: "CL",
  via: "DEMO",
};

describe("paginación del discovery", () => {
  const numeros137 = Array.from({ length: 137 }, (_, i) => String(i + 1));
  const porNumero137 = Object.fromEntries(
    numeros137.map((numero, i) => [
      numero,
      consultaOk([inmueble({ rc20: rcDe(i + 1), numero, ltp: ltpNo })]),
    ])
  );

  it("1. 137 portales → página 1", async () => {
    const store = createDiscoveryStore();
    const { client } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    const result = await discoverFincas(query, client, {
      paginated: true,
      pageSize: 40,
      store,
    });
    assert.equal(result.discovery.portalsFound, 137);
    assert.equal(result.discovery.portalsProcessed, 40);
    assert.equal(result.discovery.page, 1);
    assert.equal(result.discovery.pageSize, 40);
    assert.equal(result.discovery.truncated, true);
    assert.equal(result.discovery.hasNextPage, true);
    assert.equal(result.discovery.complete, false);
    assert.ok(result.discovery.nextCursor);
    assert.equal(result.portals.length, 40);
    assert.equal(result.portals[0]?.number, "1");
    assert.equal(result.portals[39]?.number, "40");
  });

  it("2 y 4. continuación → página 2 con hasNextPage", async () => {
    const store = createDiscoveryStore();
    const { client } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    const primera = await discoverFincas(query, client, {
      paginated: true,
      pageSize: 40,
      store,
    });
    const segunda = await discoverFincas(query, client, {
      paginated: true,
      pageSize: 40,
      cursor: primera.discovery.nextCursor ?? undefined,
      store,
    });
    assert.equal(segunda.discovery.page, 2);
    assert.equal(segunda.discovery.portalsProcessed, 40);
    assert.equal(segunda.discovery.hasNextPage, true);
    assert.equal(segunda.portals[0]?.number, "41");
    assert.equal(segunda.portals[39]?.number, "80");
  });

  it("3 y 5. última página y complete", async () => {
    const store = createDiscoveryStore();
    const { client } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    let cursor: string | undefined;
    let ultima = await discoverFincas(query, client, { paginated: true, pageSize: 40, store });
    cursor = ultima.discovery.nextCursor ?? undefined;
    while (cursor) {
      ultima = await discoverFincas(query, client, {
        paginated: true,
        pageSize: 40,
        cursor,
        store,
      });
      cursor = ultima.discovery.nextCursor ?? undefined;
    }
    assert.equal(ultima.discovery.page, 4);
    assert.equal(ultima.discovery.portalsProcessed, 17);
    assert.equal(ultima.discovery.hasNextPage, false);
    assert.equal(ultima.discovery.complete, true);
    assert.equal(ultima.discovery.nextCursor, null);
  });

  it("6. possibleCut impide complete aunque no haya más páginas", async () => {
    const store = createDiscoveryStore();
    const { client } = mockPaginado({
      numeros: ["3", "5", "7"],
      gmlAttrs: 'numberMatched="9000" numberReturned="3"',
      porNumero: {
        "3": consultaOk([inmueble({ rc20: rcDe(1), numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: rcDe(2), numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: rcDe(3), numero: "7", ltp: ltpNo })]),
      },
    });
    const result = await discoverFincas(query, client, { paginated: true, pageSize: 40, store });
    assert.equal(result.discovery.hasNextPage, false);
    assert.equal(result.discovery.possibleCut, true);
    assert.equal(result.discovery.complete, false);
  });

  it("7. misma finca en varias páginas acumula portales", async () => {
    const store = createDiscoveryStore();
    const { client } = mockPaginado({
      numeros: ["10", "11", "12", "13"],
      porNumero: {
        "10": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10" })]),
        "11": consultaOk([inmueble({ rc20: "BBBBBBBBBBBBBB0001AA", numero: "11", ltp: ltpNo })]),
        "12": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "12" })]),
        "13": consultaOk([inmueble({ rc20: "CCCCCCCCCCCCCC0001AA", numero: "13", ltp: ltpNo })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", ltp: ltpNo }),
      ]),
    });
    const p1 = await discoverFincas(query, client, { paginated: true, pageSize: 2, store });
    const p2 = await discoverFincas(query, client, {
      paginated: true,
      pageSize: 2,
      cursor: p1.discovery.nextCursor ?? undefined,
      store,
    });
    const finca1 = p1.fincas.find((item) => item.fincaReference === "AAAAAAAAAAAAAA");
    const finca2 = p2.fincas.find((item) => item.fincaReference === "AAAAAAAAAAAAAA");
    assert.deepEqual(finca1?.portals, ["10"]);
    assert.deepEqual(finca2?.portals, ["10", "12"]);
  });

  it("8 y 9. DNPLOC solo de la página y DNPRC una vez por finca", async () => {
    const store = createDiscoveryStore();
    const { client, counters } = mockPaginado({
      numeros: ["10", "11", "12", "13"],
      porNumero: {
        "10": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10" })]),
        "11": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0002BB", numero: "11" })]),
        "12": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0003CC", numero: "12" })]),
        "13": consultaOk([inmueble({ rc20: "AAAAAAAAAAAAAA0004DD", numero: "13" })]),
      },
      detalle: consultaOk([
        inmueble({ rc20: "AAAAAAAAAAAAAA0001AA", numero: "10", ltp: ltpNo }),
      ]),
    });
    const p1 = await discoverFincas(query, client, { paginated: true, pageSize: 2, store });
    assert.equal(counters.dnploc, 2);
    assert.equal(counters.dnprc, 1);
    await discoverFincas(query, client, {
      paginated: true,
      pageSize: 2,
      cursor: p1.discovery.nextCursor ?? undefined,
      store,
    });
    assert.equal(counters.dnploc, 4);
    assert.equal(counters.dnprc, 1);
  });

  it("10. no repite INSPIRE en páginas siguientes", async () => {
    const store = createDiscoveryStore();
    const { client, counters } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    const p1 = await discoverFincas(query, client, { paginated: true, pageSize: 40, store });
    await discoverFincas(query, client, {
      paginated: true,
      cursor: p1.discovery.nextCursor ?? undefined,
      store,
    });
    await discoverFincas(query, client, {
      paginated: true,
      discoveryId: p1.discovery.discoveryId ?? undefined,
      page: 3,
      store,
    });
    assert.equal(counters.inspire, 1);
  });

  it("11. expiración del estado temporal", async () => {
    let ahora = 1_000;
    const store = createDiscoveryStore({ ttlMs: 50, now: () => ahora });
    const { client } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    const p1 = await discoverFincas(query, client, { paginated: true, pageSize: 40, store });
    ahora += 100;
    await assert.rejects(
      () =>
        discoverFincas(query, client, {
          paginated: true,
          cursor: p1.discovery.nextCursor ?? undefined,
          store,
        }),
      /expirado/i
    );
  });

  it("12 y 13. parámetros inválidos y pageSize excesivo", async () => {
    const invalido = parsearDiscovery(new URLSearchParams("cursor=%%%"));
    assert.equal(invalido.ok, true);
    if (invalido.ok) {
      const response = await responderDiscoveryCatastro(
        requestDe("cursor=%%%"),
        usuario,
        mockPaginado({ numeros: ["3"], porNumero: {} }).client
      );
      assert.equal(response.status, 400);
    }

    const pageCero = parsearDiscovery(
      new URLSearchParams("provincia=MADRID&municipio=MADRID&sigla=CL&via=DEMO&page=0")
    );
    assert.equal(pageCero.ok, false);

    const enorme = parsearDiscovery(
      new URLSearchParams(
        "provincia=MADRID&municipio=MADRID&sigla=CL&via=DEMO&pageSize=100000"
      )
    );
    assert.equal(enorme.ok, true);
    if (enorme.ok) assert.equal(enorme.options.pageSize, API_MAX_PORTALS);
  });

  it("14. búsqueda pequeña cabe en una sola página", async () => {
    const store = createDiscoveryStore();
    const { client, counters } = mockPaginado({
      numeros: ["3", "5", "7"],
      porNumero: {
        "3": consultaOk([inmueble({ rc20: rcDe(1), numero: "3", ltp: ltpNo })]),
        "5": consultaOk([inmueble({ rc20: rcDe(2), numero: "5", ltp: ltpNo })]),
        "7": consultaOk([inmueble({ rc20: rcDe(3), numero: "7", ltp: ltpNo })]),
      },
    });
    const result = await discoverFincas(query, client, { paginated: true, pageSize: 40, store });
    assert.equal(result.discovery.hasNextPage, false);
    assert.equal(result.discovery.complete, true);
    assert.equal(result.discovery.page, 1);
    assert.equal(result.portals.length, 3);
    assert.equal(counters.inspire, 1);
    assert.equal(result.discovery.nextCursor, null);
  });

  it("API: cursor continúa sin reenviar la vía", async () => {
    const store = createDiscoveryStore();
    const { client, counters } = mockPaginado({ numeros: numeros137, porNumero: porNumero137 });
    const primera = await responderDiscoveryCatastro(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=DEMO&pageSize=40"),
      usuario,
      client,
      store
    );
    const body1 = await leerJson(primera);
    const cursor = (body1.discovery as { nextCursor: string }).nextCursor;
    const segunda = await responderDiscoveryCatastro(
      requestDe(`cursor=${encodeURIComponent(cursor)}`),
      usuario,
      client,
      store
    );
    assert.equal(segunda.status, 200);
    const body2 = await leerJson(segunda);
    assert.equal((body2.discovery as { page: number }).page, 2);
    assert.equal((body2.query as { via: string }).via, "DEMO");
    assert.equal(counters.inspire, 1);
  });
});

describe("paginación real", { skip: skipLive }, () => {
  it("Godelleta cabe en una sola página", async () => {
    const store = createDiscoveryStore();
    const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });
    const response = await responderDiscoveryCatastro(
      requestDe("provincia=VALENCIA&municipio=GODELLETA&sigla=CL&via=GUAYANA-MOJONERA"),
      usuario,
      client,
      store
    );
    assert.equal(response.status, 200);
    const body = await leerJson(response);
    const discovery = body.discovery as Record<string, unknown>;
    assert.equal(discovery.portalsFound, 3);
    assert.equal(discovery.hasNextPage, false);
    assert.equal(discovery.complete, true);
    assert.deepEqual(
      (body.portals as Array<{ number: string }>).map((item) => item.number),
      ["3", "5", "7"]
    );
  });

  it("Fuencarral recorre páginas sin repetir INSPIRE", async () => {
    const store = createDiscoveryStore();
    let inspire = 0;
    const base = createCatastroClient({
      minIntervalMs: 400,
      cacheTtlMs: 60_000,
      timeoutMs: 90_000,
    });
    const client = {
      ...base,
      obtenerDireccionesPorCodigoVia: async (params) => {
        inspire += 1;
        return base.obtenerDireccionesPorCodigoVia(params);
      },
    };
    const p1 = await responderDiscoveryCatastro(
      requestDe("provincia=MADRID&municipio=MADRID&sigla=CL&via=FUENCARRAL&pageSize=3"),
      usuario,
      client,
      store
    );
    assert.equal(p1.status, 200);
    const b1 = await leerJson(p1);
    const d1 = b1.discovery as {
      portalsFound: number;
      hasNextPage: boolean;
      nextCursor: string;
      complete: boolean;
      discoveryId: string;
      completeCandidates: boolean;
    };
    assert.ok(d1.portalsFound > 40);
    assert.equal(d1.hasNextPage, true);
    assert.equal(d1.complete, false);
    assert.equal((b1.portals as unknown[]).length, 3);

    const p2 = await responderDiscoveryCatastro(
      requestDe(`cursor=${encodeURIComponent(d1.nextCursor)}`),
      usuario,
      client,
      store
    );
    const b2 = await leerJson(p2);
    const p3 = await responderDiscoveryCatastro(
      requestDe(`cursor=${encodeURIComponent((b2.discovery as { nextCursor: string }).nextCursor)}`),
      usuario,
      client,
      store
    );
    const b3 = await leerJson(p3);
    assert.equal((b2.discovery as { page: number }).page, 2);
    assert.equal((b3.discovery as { page: number }).page, 3);
    assert.equal((b2.portals as unknown[]).length, 3);
    assert.equal((b3.portals as unknown[]).length, 3);
    assert.equal(inspire, 1);
    assert.equal((b3.discovery as { complete: boolean }).complete, false);
    assert.equal((b1.discovery as { completeCandidates: boolean }).completeCandidates, false);
    assert.equal((b2.discovery as { completeCandidates: boolean }).completeCandidates, false);
    assert.equal((b3.discovery as { completeCandidates: boolean }).completeCandidates, false);

    const vistas = new Map<string, string[]>();
    for (const body of [b1, b2, b3]) {
      for (const finca of body.fincas as Array<{ fincaReference: string; portals: string[] }>) {
        const previa = vistas.get(finca.fincaReference);
        if (previa) {
          assert.ok(finca.portals.length >= previa.length);
          assert.ok(previa.every((portal) => finca.portals.includes(portal)));
        }
        vistas.set(finca.fincaReference, finca.portals);
      }
    }

    const p1No = await responderDiscoveryCatastro(
      requestDe(
        `discoveryId=${encodeURIComponent(d1.discoveryId)}&page=1&horizontalDivision=NO`
      ),
      usuario,
      client,
      store
    );
    const b1No = await leerJson(p1No);
    assert.ok(
      (b1No.fincas as Array<{ horizontalDivision: { status: string } }>).every(
        (item) => item.horizontalDivision.status === "NO"
      )
    );
    assert.equal((b1No.discovery as { completeCandidates: boolean }).completeCandidates, false);

    for (const body of [b1, b2, b3]) {
      for (const finca of body.fincas as Array<{
        fincaReference: string;
        propertyReferences: string[];
        ltp: string | null;
        postalCodes: string[];
      }>) {
        assert.equal(finca.fincaReference.length, 14);
        assert.ok(finca.propertyReferences.every((ref) => ref.length === 20));
        assert.ok(finca.ltp);
        assert.ok(finca.postalCodes.length > 0);
      }
    }
  });
});
