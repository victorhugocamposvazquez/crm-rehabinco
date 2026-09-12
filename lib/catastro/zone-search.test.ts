import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCatalogCache, normalizarNombreCatalogo, type CalleCatalogo } from "./catalog";
import { createCatastroClient, type CatastroClient } from "./client";
import { buscarFincasComerciales, type CriteriosBusquedaComercial, type Finca } from "./commercial-search";
import { ZONE_MAX_CONSECUTIVE_FAILURES } from "./constants";
import { createDiscoveryStore } from "./discovery-session";
import {
  leerParametrosZona,
  responderZonaCancelar,
  responderZonaEstado,
  responderZonaPaso,
  responderZonaPreparar,
  responderZonaReanudar,
} from "./search-zone";
import {
  cancelarZona,
  cuentaParaProteccion,
  ejecutarPasoZona,
  normalizarCriteriosZona,
  ordenarFincasZona,
  prepararZona,
  reanudarZona,
  snapshotZona,
  type BuscarCalle,
  type ZoneDeps,
  type ZoneSession,
} from "./zone-search";
import { createZoneStore } from "./zone-session";

const USUARIO = { id: "user-1" };
const PROVINCIA = "VALENCIA";
const MUNICIPIO = "GODELLETA";

type FincaFalsa = {
  ref: string;
  via: string;
  sigla?: string;
  numero: string;
  cp: string | string[];
  status?: "NO" | "YES" | "UNKNOWN" | "NOT_APPLICABLE";
};

type CalleFalsa = {
  calle: CalleCatalogo;
  fincas?: FincaFalsa[];
  error?: "upstream" | "not_found" | "invalid" | "http404";
  possibleCut?: boolean;
  /** Portales por finca; permite simular paginación. */
  demoraMs?: number;
};

function fincaFalsa(input: FincaFalsa): Finca {
  const postalCodes = Array.isArray(input.cp) ? input.cp : [input.cp];
  const status = input.status ?? "NO";
  return {
    fincaReference: input.ref,
    propertyReferences: [`${input.ref}0001AA`],
    properties: [
      {
        reference: `${input.ref}0001AA`,
        postalCode: postalCodes[0],
        numero: input.numero,
        unidades: [],
      },
    ],
    portals: [input.numero],
    address: {
      provincia: PROVINCIA,
      municipio: MUNICIPIO,
      sigla: input.sigla ?? "CL",
      via: input.via,
      numero: input.numero,
    },
    postalCode: postalCodes[0],
    postalCodes,
    ltp: status === "NO" ? "Parcela construida sin división horizontal" : undefined,
    horizontalDivision: {
      status,
      confidence: status === "UNKNOWN" ? 0 : 1,
      reason: `test ${status}`,
    },
  };
}

function calle(code: string, name: string, sigla = "CL"): CalleCatalogo {
  return { code, sigla, name };
}

type MundoFalso = {
  buscar: BuscarCalle;
  llamadas: CriteriosBusquedaComercial[];
  llamadasPorCalle: Map<string, number>;
  maxSimultaneas: number;
  liberar: () => void;
};

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Sustituto de `buscarFincasComerciales`: aplica CP y pageSize como el motor real y
 * devuelve la misma forma de respuesta. Nada de HTTP.
 */
function mundoFalso(calles: CalleFalsa[], opciones: { bloquear?: boolean } = {}): MundoFalso {
  const porNombre = new Map(calles.map((item) => [item.calle.name, item] as const));
  const llamadas: CriteriosBusquedaComercial[] = [];
  const llamadasPorCalle = new Map<string, number>();
  let activas = 0;
  let maxSimultaneas = 0;
  let bloqueado = Boolean(opciones.bloquear);
  const esperando: Array<() => void> = [];

  const buscar: BuscarCalle = async (criterios) => {
    llamadas.push(criterios);
    const nombre = criterios.via ?? "";
    llamadasPorCalle.set(nombre, (llamadasPorCalle.get(nombre) ?? 0) + 1);
    activas += 1;
    maxSimultaneas = Math.max(maxSimultaneas, activas);
    try {
      if (bloqueado) {
        await new Promise<void>((resolve) => esperando.push(resolve));
      }
      const definicion = porNombre.get(nombre);
      if (definicion?.demoraMs) await esperar(definicion.demoraMs);
      await esperar(0);
      const search = {
        provincia: PROVINCIA,
        municipio: MUNICIPIO,
        sigla: criterios.sigla ?? "CL",
        via: nombre,
        postalCode: criterios.postalCode,
        horizontalDivision: "ALL" as const,
      };
      if (!definicion || definicion.error === "invalid") {
        return { ok: false, code: "invalid", error: "La sigla no es un tipo de vía del Anexo II.", search };
      }
      if (definicion.error === "upstream") {
        return { ok: false, code: "upstream", error: "Error externo de Catastro o INSPIRE.", search };
      }
      if (definicion.error === "http404") {
        return {
          ok: false,
          code: "upstream",
          error: { codigo: "http", descripcion: "Catastro respondió HTTP 404 en Consulta_DNPRC" },
          search,
        };
      }
      if (definicion.error === "not_found") {
        return {
          ok: false,
          code: "not_found",
          error: { codigo: "10", descripcion: "NO EXISTE LA VIA" },
          search,
        };
      }
      const todas = (definicion.fincas ?? [])
        .map(fincaFalsa)
        .filter((finca) => !criterios.postalCode || finca.postalCodes.includes(criterios.postalCode));
      const pageSize = criterios.pageSize ?? 20;
      const offset = criterios.cursor ? Number(criterios.cursor) : 0;
      const pagina = todas.slice(offset, offset + pageSize);
      const hasNextPage = offset + pageSize < todas.length;
      const tieneUnknown = pagina.some((finca) => finca.horizontalDivision.status === "UNKNOWN");
      const resultado = {
        ok: true as const,
        search,
        results: pagina,
        pagination: {
          hasNextPage,
          ...(hasNextPage ? { nextCursor: String(offset + pageSize) } : {}),
        },
        coverage: {
          complete: !definicion.possibleCut && !hasNextPage,
          completeCandidates: !definicion.possibleCut && !hasNextPage && !tieneUnknown,
          possibleCut: Boolean(definicion.possibleCut),
          portalsFound: todas.length,
          portalsProcessed: pagina.length,
        },
      };
      return {
        ok: true,
        resultado,
        discovery: {} as never,
        candidatos: {} as never,
      };
    } finally {
      activas -= 1;
    }
  };

  return {
    buscar,
    llamadas,
    llamadasPorCalle,
    get maxSimultaneas() {
      return maxSimultaneas;
    },
    liberar() {
      bloqueado = false;
      for (const resolve of esperando.splice(0)) resolve();
    },
  };
}

function depsFalsas(mundo: MundoFalso, calles: CalleCatalogo[], extra: Partial<ZoneDeps> = {}): ZoneDeps {
  const catalogCache = createCatalogCache();
  catalogCache.set("provinces", [{ code: "46", name: PROVINCIA }]);
  catalogCache.set(`municipalities:${normalizarNombreCatalogo(PROVINCIA)}`, [
    { code: "138", name: MUNICIPIO },
  ]);
  catalogCache.set(
    `streets:${normalizarNombreCatalogo(PROVINCIA)}:${normalizarNombreCatalogo(MUNICIPIO)}`,
    calles
  );
  return {
    client: {} as CatastroClient,
    catalogCache,
    discoveryStore: createDiscoveryStore(),
    zoneStore: createZoneStore(),
    buscar: mundo.buscar,
    ...extra,
  };
}

const CRITERIOS = { provincia: "Valencia", municipio: "Godelleta", postalCode: "46388" };

async function prepararOk(deps: ZoneDeps, criterios: Record<string, string> = CRITERIOS): Promise<ZoneSession> {
  const preparada = await prepararZona(criterios, USUARIO, deps);
  assert.equal(preparada.ok, true);
  if (!preparada.ok) throw new Error("unreachable");
  return preparada.session;
}

async function ejecutarHastaTerminar(session: ZoneSession, deps: ZoneDeps, budgetMs = 5_000) {
  let snapshot = snapshotZona(session);
  for (let i = 0; i < 50; i += 1) {
    snapshot = await ejecutarPasoZona(session, { budgetMs }, deps);
    if (snapshot.status !== "paused" && snapshot.status !== "prepared") break;
  }
  return snapshot;
}

const CALLES_BASE: CalleFalsa[] = [
  {
    calle: calle("57", "GUAYANA-MOJONERA"),
    fincas: [
      { ref: "2749704YJ0624N", via: "GUAYANA-MOJONERA", numero: "3", cp: "46388" },
      { ref: "2749705YJ0624N", via: "GUAYANA-MOJONERA", numero: "5", cp: "46388", status: "YES" },
    ],
  },
  {
    calle: calle("12", "MAYOR"),
    fincas: [
      { ref: "1111111AA1111A", via: "MAYOR", numero: "10", cp: "46388" },
      { ref: "2222222BB2222B", via: "MAYOR", numero: "2", cp: "46389" },
    ],
  },
  { calle: calle("99", "SIN PORTALES") },
];

describe("Zona: criterios", () => {
  it("exige provincia y municipio; el código postal es opcional", () => {
    const sinCp = normalizarCriteriosZona({ provincia: "Valencia", municipio: "Godelleta" });
    assert.equal(sinCp.ok, true);
    if (sinCp.ok) assert.equal(sinCp.criterios.postalCode, "");
    const vacio = normalizarCriteriosZona({});
    assert.equal(vacio.ok, false);
    if (!vacio.ok) assert.match(vacio.error, /provincia, municipio/);
    assert.doesNotMatch(vacio.ok ? "" : vacio.error, /postalCode/);
  });

  it("el código postal debe tener 5 dígitos y no admite calle ni número", () => {
    const corto = normalizarCriteriosZona({ ...CRITERIOS, postalCode: "4638" });
    assert.equal(corto.ok, false);
    const conCalle = normalizarCriteriosZona({ ...CRITERIOS, via: "MAYOR" });
    assert.equal(conCalle.ok, false);
    if (!conCalle.ok) assert.match(conCalle.error, /no admite calle ni número/);
    const conNumero = normalizarCriteriosZona({ ...CRITERIOS, numero: "3" });
    assert.equal(conNumero.ok, false);
  });

  it("división horizontal: NO por defecto y admite ALL/YES/NO/UNKNOWN", () => {
    const defecto = normalizarCriteriosZona(CRITERIOS);
    assert.equal(defecto.ok && defecto.criterios.horizontalDivision, "NO");
    const todas = normalizarCriteriosZona({ ...CRITERIOS, horizontalDivision: "all" });
    assert.equal(todas.ok && todas.criterios.horizontalDivision, "ALL");
    const invalido = normalizarCriteriosZona({ ...CRITERIOS, horizontalDivision: "MAYBE" });
    assert.equal(invalido.ok, false);
  });
});

describe("Zona: preparación", () => {
  it("lista las calles oficiales sin ejecutar ninguna búsqueda", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = snapshotZona(session);
    assert.equal(snapshot.status, "prepared");
    assert.equal(snapshot.progress.streetsFound, 3);
    assert.equal(snapshot.progress.streetsProcessed, 0);
    assert.equal(snapshot.nextAction, "start");
    assert.equal(snapshot.criteria.municipio, MUNICIPIO);
    assert.equal(mundo.llamadas.length, 0);
    assert.deepEqual(
      session.calles.map((item) => item.calle.name),
      ["GUAYANA-MOJONERA", "MAYOR", "SIN PORTALES"]
    );
    assert.equal(snapshot.coverage.streetsTotal, 3);
    assert.equal(snapshot.coverage.streetOffset, 0);
    assert.equal(snapshot.coverage.hasNextBlock, false);
  });

  it("parte un callejero grande en bloques y el siguiente offset continúa", async () => {
    const calles = Array.from({ length: 300 }, (_, i) => calle(String(i + 1), `CALLE ${i + 1}`));
    const mundo = mundoFalso(calles.map((item) => ({ calle: item })));
    const deps = depsFalsas(mundo, calles);
    const primero = await prepararOk(deps);
    assert.equal(primero.calles.length, 250);
    assert.equal(primero.streetsTotal, 300);
    assert.equal(primero.streetOffset, 0);
    const snap1 = snapshotZona(primero);
    assert.equal(snap1.coverage.hasNextBlock, true);
    assert.equal(snap1.coverage.streetsFound, 250);

    const segundo = await prepararOk(deps, { ...CRITERIOS, streetOffset: "250" });
    assert.equal(segundo.calles.length, 50);
    assert.equal(segundo.streetOffset, 250);
    assert.equal(segundo.id === primero.id, false);
    const snap2 = snapshotZona(segundo);
    assert.equal(snap2.coverage.hasNextBlock, false);
    assert.equal(snap2.coverage.streetsTotal, 300);

    const fuera = await prepararZona({ ...CRITERIOS, streetOffset: 300 }, USUARIO, deps);
    assert.equal(fuera.ok, false);
  });

  it("con CP solo prepara las vías que GetADByPostalCode lista", async () => {
    const calles = [calle("11", "AGRA MONTES"), calle("88", "MAYOR"), calle("999", "OTRA")];
    const mundo = mundoFalso(calles.map((item) => ({ calle: item })));
    const deps = depsFalsas(mundo, calles, {
      client: {
        obtenerDireccionesPorCodigoPostal: async () => `<gml:FeatureCollection>
          <gml:featureMember><ad:Address>
            <base:localId>15.900.11.10.8801701NJ4080S</base:localId>
            <ad:LocatorDesignator><ad:designator>10</ad:designator></ad:LocatorDesignator>
            <ad:component xlink:href="#ES.SDGC.PD.15.900.15009" />
            <ad:component xlink:href="#ES.SDGC.TN.15.900.11" />
          </ad:Address></gml:featureMember>
          <gml:featureMember><ad:Address>
            <base:localId>15.900.88.2.AAAAAAAAAAAAAA</base:localId>
            <ad:LocatorDesignator><ad:designator>2</ad:designator></ad:LocatorDesignator>
            <ad:component xlink:href="#ES.SDGC.TN.15.900.88" />
          </ad:Address></gml:featureMember>
        </gml:FeatureCollection>`,
      } as CatastroClient,
    });
    const session = await prepararOk(deps, { ...CRITERIOS, postalCode: "15009" });
    assert.deepEqual(
      session.calles.map((item) => item.calle.code),
      ["11", "88"]
    );
    assert.equal(session.streetsTotal, 2);
    assert.equal(snapshotZona(session).coverage.hasNextBlock, false);
  });

  it("rechaza provincia o municipio no oficiales", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const resultado = await prepararZona({ ...CRITERIOS, municipio: "ATLANTIS" }, USUARIO, deps);
    assert.equal(resultado.ok, false);
    if (!resultado.ok) {
      assert.equal(resultado.code, "invalid");
      assert.match(resultado.error, /municipio oficial/);
    }
  });

  it("reutiliza la sesión de la misma zona en vez de volver a recorrerla", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps);
    await ejecutarHastaTerminar(session, deps);
    const llamadas = mundo.llamadas.length;
    const otra = await prepararZona({ ...CRITERIOS, horizontalDivision: "ALL" }, USUARIO, deps);
    assert.equal(otra.ok && otra.reused, true);
    if (otra.ok) {
      assert.equal(otra.session.id, session.id);
      assert.equal(otra.session.criterios.horizontalDivision, "ALL");
      assert.equal(snapshotZona(otra.session).status, "done");
    }
    assert.equal(mundo.llamadas.length, llamadas);
  });
});

describe("Zona: resultados", () => {
  it("cero coincidencias cuando ninguna finca tiene ese CP (sin error)", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps, { ...CRITERIOS, postalCode: "28004" });
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "done");
    assert.equal(snapshot.results.length, 0);
    assert.equal(snapshot.progress.fincasFound, 0);
    assert.equal(snapshot.coverage.complete, true);
    assert.equal(snapshot.coverage.streetsProcessed, 3);
    assert.equal(snapshot.errors.length, 0);
    for (const llamada of mundo.llamadas) assert.equal(llamada.postalCode, "28004");
  });

  it("una coincidencia: solo la finca cuyo postalCodes incluye el CP y sin división", async () => {
    const calles: CalleFalsa[] = [
      {
        calle: calle("1", "UNICA"),
        fincas: [
          { ref: "AAAAAAA0000001", via: "UNICA", numero: "1", cp: ["46389", "46388"] },
          { ref: "AAAAAAA0000002", via: "UNICA", numero: "2", cp: "46389" },
          { ref: "AAAAAAA0000003", via: "UNICA", numero: "3", cp: "46388", status: "YES" },
        ],
      },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.deepEqual(
      snapshot.results.map((finca) => finca.fincaReference),
      ["AAAAAAA0000001"]
    );
    assert.equal(snapshot.progress.fincasFound, 2);
    assert.equal(snapshot.progress.candidates, 1);
  });

  it("varias coincidencias en orden vía → número oficial", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "done");
    assert.deepEqual(
      snapshot.results.map((finca) => `${finca.address.via} ${finca.address.numero}`),
      ["GUAYANA-MOJONERA 3", "MAYOR 10"]
    );
    assert.equal(snapshot.progress.fincasFound, 3);
    assert.equal(snapshot.progress.candidates, 2);
  });

  it("el filtro de división se aplica a la salida (YES / ALL / UNKNOWN)", async () => {
    const calles: CalleFalsa[] = [
      {
        calle: calle("1", "MIXTA"),
        fincas: [
          { ref: "BBBBBBB0000001", via: "MIXTA", numero: "1", cp: "46388", status: "NO" },
          { ref: "BBBBBBB0000002", via: "MIXTA", numero: "2", cp: "46388", status: "YES" },
          { ref: "BBBBBBB0000003", via: "MIXTA", numero: "3", cp: "46388", status: "UNKNOWN" },
        ],
      },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps, { ...CRITERIOS, horizontalDivision: "YES" });
    let snapshot = await ejecutarHastaTerminar(session, deps);
    assert.deepEqual(snapshot.results.map((f) => f.fincaReference), ["BBBBBBB0000002"]);
    session.criterios.horizontalDivision = "ALL";
    snapshot = snapshotZona(session);
    assert.equal(snapshot.results.length, 3);
    session.criterios.horizontalDivision = "UNKNOWN";
    snapshot = snapshotZona(session);
    assert.deepEqual(snapshot.results.map((f) => f.fincaReference), ["BBBBBBB0000003"]);
    session.criterios.horizontalDivision = "NO";
    snapshot = snapshotZona(session);
    assert.deepEqual(snapshot.results.map((f) => f.fincaReference), ["BBBBBBB0000001"]);
    assert.equal(snapshot.coverage.completeCandidates, false, "UNKNOWN impide exhaustividad");
  });

  it("deduplica por fincaReference acumulando portales de calles distintas", async () => {
    const calles: CalleFalsa[] = [
      {
        calle: calle("1", "ESQUINA A"),
        fincas: [{ ref: "CCCCCCC0000001", via: "ESQUINA A", numero: "1", cp: "46388" }],
      },
      {
        calle: calle("2", "ESQUINA B"),
        fincas: [{ ref: "CCCCCCC0000001", via: "ESQUINA B", numero: "8", cp: "46388" }],
      },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.results.length, 1);
    assert.equal(snapshot.progress.fincasFound, 1);
    assert.deepEqual(snapshot.results[0]?.portals, ["1", "8"]);
    assert.equal(snapshot.results[0]?.propertyReferences.length, 1);
  });

  it("recorre múltiples calles por páginas y conserva el cursor entre pasos", async () => {
    const muchas = Array.from({ length: 45 }, (_, i) => ({
      ref: `DDDDDDD00000${String(i).padStart(2, "0")}`,
      via: "LARGA",
      numero: String(i + 1),
      cp: "46388",
    }));
    const calles: CalleFalsa[] = [
      { calle: calle("1", "LARGA"), fincas: muchas, demoraMs: 5 },
      { calle: calle("2", "CORTA"), fincas: [{ ref: "EEEEEEE0000001", via: "CORTA", numero: "4", cp: "46388" }] },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    // Presupuesto mínimo: la calle larga queda a medias con cursor.
    const primero = await ejecutarPasoZona(session, { budgetMs: 1, concurrency: 1 }, deps);
    assert.equal(primero.status, "paused");
    const larga = session.calles.find((item) => item.calle.name === "LARGA");
    assert.ok(larga?.cursor, "la calle larga guarda su cursor");
    assert.equal(larga?.status, "pending");
    const final = await ejecutarHastaTerminar(session, deps);
    assert.equal(final.status, "done");
    assert.equal(final.progress.fincasFound, 46);
    assert.equal(larga?.pages, 3);
    assert.equal(larga?.portalsProcessed, 45);
    assert.equal(mundo.llamadasPorCalle.get("LARGA"), 3);
    assert.equal(mundo.llamadasPorCalle.get("CORTA"), 1);
  });
});

describe("Zona: cobertura", () => {
  it("un error individual queda registrado y no detiene la búsqueda", async () => {
    const calles: CalleFalsa[] = [
      { calle: calle("1", "ROTA"), error: "upstream" },
      { calle: calle("2", "SANA"), fincas: [{ ref: "FFFFFFF0000001", via: "SANA", numero: "1", cp: "46388" }] },
      { calle: calle("3", "INEXISTENTE"), error: "not_found" },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "done");
    assert.equal(snapshot.results.length, 1);
    assert.equal(snapshot.coverage.streetsProcessed, 3);
    assert.equal(snapshot.coverage.streetsWithErrors, 1);
    assert.deepEqual(snapshot.errors, [
      { street: "CL ROTA", error: "Error externo de Catastro o INSPIRE." },
    ]);
    assert.equal(snapshot.coverage.complete, false);
    assert.equal(snapshot.coverage.completeCandidates, false);
  });

  it("complete solo si todas las calles terminan sin errores ni corte", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps);
    const parcial = await ejecutarPasoZona(session, { budgetMs: 1, concurrency: 1 }, deps);
    assert.equal(parcial.coverage.complete, false, "a medias nunca es completa");
    const final = await ejecutarHastaTerminar(session, deps);
    assert.deepEqual(final.coverage, {
      streetsFound: 3,
      streetsProcessed: 3,
      streetsWithErrors: 0,
      complete: true,
      completeCandidates: true,
      possibleCut: false,
      streetsTotal: 3,
      streetOffset: 0,
      hasNextBlock: false,
    });
  });

  it("completeCandidates es false si alguna calle deja fincas UNKNOWN", async () => {
    const calles: CalleFalsa[] = [
      {
        calle: calle("1", "DUDOSA"),
        fincas: [
          { ref: "GGGGGGG0000001", via: "DUDOSA", numero: "1", cp: "46388" },
          { ref: "GGGGGGG0000002", via: "DUDOSA", numero: "2", cp: "46388", status: "UNKNOWN" },
        ],
      },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.coverage.complete, true);
    assert.equal(snapshot.coverage.completeCandidates, false);
    assert.deepEqual(snapshot.results.map((f) => f.fincaReference), ["GGGGGGG0000001"]);
  });

  it("possibleCut de una calle marca la zona como posiblemente incompleta", async () => {
    const calles: CalleFalsa[] = [
      {
        calle: calle("1", "ENORME"),
        possibleCut: true,
        fincas: [{ ref: "HHHHHHH0000001", via: "ENORME", numero: "1", cp: "46388" }],
      },
      { calle: calle("2", "NORMAL"), fincas: [] },
    ];
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "done");
    assert.equal(snapshot.coverage.possibleCut, true);
    assert.equal(snapshot.coverage.complete, false);
    assert.equal(snapshot.coverage.completeCandidates, false);
    assert.equal(snapshot.results.length, 1);
  });
});

describe("Zona: control de ejecución", () => {
  it("cancelar deja de programar calles, conserva resultados y marca incompleta", async () => {
    const calles: CalleFalsa[] = Array.from({ length: 6 }, (_, i) => ({
      calle: calle(String(i), `CALLE ${i}`),
      fincas: [{ ref: `IIIIIII000000${i}`, via: `CALLE ${i}`, numero: "1", cp: "46388" }],
    }));
    const mundo = mundoFalso(calles, { bloquear: true });
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const paso = ejecutarPasoZona(session, { budgetMs: 5_000, concurrency: 2 }, deps);
    await esperar(5);
    assert.equal(session.status, "running");
    const cancelada = cancelarZona(session, deps);
    assert.equal(cancelada.status, "running", "el paso en vuelo termina por sí mismo");
    mundo.liberar();
    const snapshot = await paso;
    assert.equal(snapshot.status, "cancelled");
    assert.equal(snapshot.progress.streetsProcessed, 2, "solo las dos calles que estaban en vuelo");
    assert.equal(snapshot.results.length, 2);
    assert.equal(snapshot.coverage.complete, false);
    assert.equal(snapshot.nextAction, "resume");
    const sinTrabajo = await ejecutarPasoZona(session, { budgetMs: 5_000 }, deps);
    assert.equal(sinTrabajo.progress.streetsProcessed, 2, "cancelada: un paso no hace nada");
    assert.equal(mundo.llamadas.length, 2);
  });

  it("reanudar continúa por las calles pendientes sin reprocesar las completadas", async () => {
    const calles: CalleFalsa[] = Array.from({ length: 5 }, (_, i) => ({
      calle: calle(String(i), `CALLE ${i}`),
      fincas: [{ ref: `JJJJJJJ000000${i}`, via: `CALLE ${i}`, numero: "1", cp: "46388" }],
    }));
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    await ejecutarPasoZona(session, { budgetMs: 1, concurrency: 1 }, deps);
    cancelarZona(session, deps);
    assert.equal(session.status, "cancelled");
    const procesadasAntes = snapshotZona(session).progress.streetsProcessed;
    assert.ok(procesadasAntes >= 1 && procesadasAntes < 5);
    const reanudada = reanudarZona(session, {}, deps);
    assert.equal(reanudada.status, "prepared");
    assert.equal(reanudada.nextAction, "step");
    const final = await ejecutarHastaTerminar(session, deps);
    assert.equal(final.status, "done");
    assert.equal(final.results.length, 5);
    for (const [, veces] of mundo.llamadasPorCalle) assert.equal(veces, 1);
  });

  it("respeta el límite de calles simultáneas (defecto 2, máximo 5)", async () => {
    const calles: CalleFalsa[] = Array.from({ length: 12 }, (_, i) => ({
      calle: calle(String(i), `CALLE ${i}`),
      fincas: [],
      demoraMs: 8,
    }));
    const porDefecto = mundoFalso(calles);
    const depsDefecto = depsFalsas(porDefecto, calles.map((item) => item.calle));
    const sesionDefecto = await prepararOk(depsDefecto);
    await ejecutarHastaTerminar(sesionDefecto, depsDefecto);
    assert.ok(porDefecto.maxSimultaneas <= 2, `defecto: ${porDefecto.maxSimultaneas}`);
    assert.ok(porDefecto.maxSimultaneas >= 2, "el pool sí trabaja en paralelo");

    const excesivo = mundoFalso(calles);
    const depsExcesivo = depsFalsas(excesivo, calles.map((item) => item.calle));
    const sesionExcesiva = await prepararOk(depsExcesivo);
    for (let i = 0; i < 20; i += 1) {
      const paso = await ejecutarPasoZona(sesionExcesiva, { budgetMs: 5_000, concurrency: 50 }, depsExcesivo);
      if (paso.status === "done") break;
    }
    assert.ok(excesivo.maxSimultaneas <= 5, `máximo: ${excesivo.maxSimultaneas}`);
  });

  it("si Catastro está caído se pausa tras pocos fallos seguidos, sin martillear", async () => {
    const calles: CalleFalsa[] = Array.from({ length: 30 }, (_, i) => ({
      calle: calle(String(i), `CALLE ${i}`),
      error: "upstream",
    }));
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "upstream_paused");
    assert.ok(
      mundo.llamadas.length <= ZONE_MAX_CONSECUTIVE_FAILURES + 2,
      `llamadas: ${mundo.llamadas.length}`
    );
    assert.ok(snapshot.progress.streetsPending >= 20);
    assert.equal(snapshot.nextAction, "resume");
    // Reanudar reintentando errores devuelve las calles rotas a pendientes.
    const reanudada = reanudarZona(session, { reintentarErrores: true }, deps);
    assert.equal(reanudada.progress.streetsWithErrors, 0);
    assert.equal(reanudada.progress.streetsPending, 30);
  });

  it("los HTTP 4xx de calles concretas no activan la pausa de protección", async () => {
    const calles: CalleFalsa[] = Array.from({ length: 12 }, (_, i) => ({
      calle: calle(String(i), `CALLE ${i}`),
      error: "http404",
    }));
    const mundo = mundoFalso(calles);
    const deps = depsFalsas(mundo, calles.map((item) => item.calle));
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.equal(snapshot.status, "done", "termina revisando todas las calles");
    assert.equal(snapshot.coverage.streetsWithErrors, 12);
    assert.equal(snapshot.coverage.complete, false);
    assert.equal(mundo.llamadas.length, 12);
    assert.equal(cuentaParaProteccion("Catastro respondió HTTP 404 en Consulta_DNPRC"), false);
    assert.equal(cuentaParaProteccion("Catastro respondió HTTP 503"), true);
    assert.equal(cuentaParaProteccion("Error externo de Catastro o INSPIRE."), true);
  });

  it("aprovecha lo ya resuelto: dos pasos de estado no repiten búsquedas", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const session = await prepararOk(deps);
    await ejecutarHastaTerminar(session, deps);
    const llamadas = mundo.llamadas.length;
    assert.equal(llamadas, 3, "una búsqueda por calle");
    await ejecutarPasoZona(session, { budgetMs: 5_000 }, deps);
    await ejecutarPasoZona(session, { budgetMs: 0 }, deps);
    assert.equal(mundo.llamadas.length, llamadas);
    assert.equal(snapshotZona(session).progress.steps, 1);
  });
});

describe("Zona: orden", () => {
  it("ordena por municipio, vía y número oficial sin inventar numeraciones", () => {
    const fincas = [
      fincaFalsa({ ref: "K000000000001", via: "MAYOR", numero: "10", cp: "46388" }),
      fincaFalsa({ ref: "K000000000002", via: "ALTA", numero: "2", cp: "46388" }),
      fincaFalsa({ ref: "K000000000003", via: "MAYOR", numero: "2", cp: "46388" }),
      fincaFalsa({ ref: "K000000000004", via: "ALTA", numero: "12", cp: "46388" }),
      fincaFalsa({ ref: "K000000000005", via: "ALTA", numero: "1", cp: "46388", sigla: "PZ" }),
    ];
    assert.deepEqual(
      ordenarFincasZona(fincas).map(
        (finca) => `${finca.address.sigla} ${finca.address.via} ${finca.address.numero}`
      ),
      ["CL ALTA 2", "CL ALTA 12", "CL MAYOR 2", "CL MAYOR 10", "PZ ALTA 1"]
    );
  });
});

describe("Zona contra Catastro (acotada)", { skip: process.env.CATASTRO_SKIP_LIVE === "1" }, () => {
  it("prepara Godelleta 46388 y da un paso corto: calles oficiales, progreso y CP coincidente", async () => {
    const client = createCatastroClient({ minIntervalMs: 400, cacheTtlMs: 60_000 });
    const deps: ZoneDeps = {
      client,
      catalogCache: createCatalogCache(),
      discoveryStore: createDiscoveryStore(),
      zoneStore: createZoneStore(),
    };
    const preparada = await prepararZona(CRITERIOS, { id: "live-zona" }, deps);
    assert.equal(preparada.ok, true);
    if (!preparada.ok) return;
    assert.ok(preparada.session.calles.length > 0, "hay calles oficiales del CP");
    assert.ok(preparada.session.calles.length <= 400, "no recorre más que el callejero de Godelleta");
    const paso = await ejecutarPasoZona(preparada.session, { budgetMs: 6_000, concurrency: 2 }, deps);
    assert.ok(paso.progress.streetsProcessed >= 1, "al menos una calle revisada");
    assert.ok(paso.progress.streetsProcessed < 400, "un paso corto no recorre el municipio");
    assert.equal(paso.status, "paused");
    for (const finca of paso.results) {
      assert.ok(finca.postalCodes.includes("46388"), `${finca.fincaReference} debe llevar el CP 46388`);
      assert.equal(finca.horizontalDivision.status, "NO");
    }
    const cancelada = cancelarZona(preparada.session, deps);
    assert.equal(cancelada.status, "cancelled");
  });
});

describe("Zona: adaptador HTTP", () => {
  function peticion(path: string, body?: Record<string, unknown>, method = "POST"): Request {
    return new Request(`http://localhost/api/catastro/zone/${path}`, {
      method,
      ...(body
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
  }

  it("lee parámetros del cuerpo JSON y de la query", async () => {
    const params = await leerParametrosZona(
      new Request("http://localhost/x?zoneSearchId=abc&budgetMs=5", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concurrency: 3, retryErrors: true, anidado: { no: 1 } }),
      })
    );
    assert.deepEqual(params, { zoneSearchId: "abc", budgetMs: "5", concurrency: "3", retryErrors: "true" });
  });

  it("prepare: 401 sin sesión, 200 sin CP (municipio), 400 con calle, 200 con CP", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    assert.equal((await responderZonaPreparar(peticion("prepare", CRITERIOS), null, deps)).status, 401);
    const sinCp = await responderZonaPreparar(
      peticion("prepare", { provincia: "Valencia", municipio: "Godelleta" }),
      USUARIO,
      deps
    );
    assert.equal(sinCp.status, 200);
    const conCalle = await responderZonaPreparar(
      peticion("prepare", { ...CRITERIOS, via: "MAYOR" }),
      USUARIO,
      deps
    );
    assert.equal(conCalle.status, 400);
    const ok = await responderZonaPreparar(peticion("prepare", CRITERIOS), USUARIO, deps);
    assert.equal(ok.status, 200);
    const cuerpo = (await ok.json()) as { zoneSearchId: string; progress: { streetsFound: number }; reused: boolean };
    assert.equal(cuerpo.progress.streetsFound, 3);
    assert.equal(cuerpo.reused, false);
    assert.equal(mundo.llamadas.length, 0, "preparar no recorre calles");
    assert.equal(Object.prototype.hasOwnProperty.call(cuerpo, "stats"), false);
  });

  it("step/cancel/resume/status: 410 sin sesión válida, 409 si ya hay un paso en curso", async () => {
    const mundo = mundoFalso(CALLES_BASE, { bloquear: true });
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle));
    const preparada = await responderZonaPreparar(peticion("prepare", CRITERIOS), USUARIO, deps);
    const { zoneSearchId } = (await preparada.json()) as { zoneSearchId: string };

    assert.equal((await responderZonaPaso(peticion("step", { zoneSearchId: "nope" }), USUARIO, deps)).status, 410);
    assert.equal(
      (await responderZonaPaso(peticion("step", { zoneSearchId }), { id: "otro-usuario" }, deps)).status,
      410
    );
    assert.equal((await responderZonaPaso(peticion("step", {}), USUARIO, deps)).status, 400);

    const enCurso = responderZonaPaso(peticion("step", { zoneSearchId, budgetMs: 5000 }), USUARIO, deps);
    await esperar(5);
    const ocupado = await responderZonaPaso(peticion("step", { zoneSearchId }), USUARIO, deps);
    assert.equal(ocupado.status, 409);
    const cancelacion = await responderZonaCancelar(peticion("cancel", { zoneSearchId }), USUARIO, deps);
    assert.equal(cancelacion.status, 200);
    mundo.liberar();
    const terminado = (await (await enCurso).json()) as { status: string };
    assert.equal(terminado.status, "cancelled");

    const estado = (await (
      await responderZonaEstado(peticion(`?zoneSearchId=${zoneSearchId}`, undefined, "GET"), USUARIO, deps)
    ).json()) as { status: string; nextAction: string };
    assert.equal(estado.status, "cancelled");
    assert.equal(estado.nextAction, "resume");

    const reanudada = (await (
      await responderZonaReanudar(peticion("resume", { zoneSearchId }), USUARIO, deps)
    ).json()) as { status: string };
    assert.equal(reanudada.status, "prepared");
  });

  it("limita las zonas activas por usuario (429) y reutiliza la misma zona", async () => {
    const mundo = mundoFalso(CALLES_BASE);
    const deps = depsFalsas(mundo, CALLES_BASE.map((item) => item.calle), {
      zoneStore: createZoneStore({ maxActivePerUser: 2 }),
    });
    const primera = await responderZonaPreparar(peticion("prepare", CRITERIOS), USUARIO, deps);
    const segunda = await responderZonaPreparar(
      peticion("prepare", { ...CRITERIOS, postalCode: "46389" }),
      USUARIO,
      deps
    );
    const tercera = await responderZonaPreparar(
      peticion("prepare", { ...CRITERIOS, postalCode: "46390" }),
      USUARIO,
      deps
    );
    assert.equal(primera.status, 200);
    assert.equal(segunda.status, 200);
    assert.equal(tercera.status, 429);
    const repetida = await responderZonaPreparar(peticion("prepare", CRITERIOS), USUARIO, deps);
    assert.equal(repetida.status, 200);
    assert.equal(((await repetida.json()) as { reused: boolean }).reused, true);
    const otroUsuario = await responderZonaPreparar(peticion("prepare", CRITERIOS), { id: "user-2" }, deps);
    assert.equal(otroUsuario.status, 200, "el límite es por usuario");
  });
});

describe("Zona: prefiltro CP (pipeline real)", () => {
  it("14. zone search con CP evita DNPRC de fincas ajenas y acumula stats", async () => {
    let dnprc = 0;
    const client = {
      consultarDireccion: async (consulta: { numero: string }) => {
        const porNumero: Record<string, Array<{ rc20: string; cp: string }>> = {
          "1": [
            { rc20: "AAAAAAAAAAAAAA0001AA", cp: "46388" },
            { rc20: "AAAAAAAAAAAAAA0002BB", cp: "28004" },
          ],
          "2": [{ rc20: "BBBBBBBBBBBBBB0001CC", cp: "28004" }],
        };
        const items = porNumero[consulta.numero] ?? [];
        return {
          query: {},
          operacion: "Consulta_DNPLOC",
          tipo: "lista",
          control: { inmuebles: items.length, construcciones: null, errores: null },
          error: null,
          results: items.map((item) => ({
            referenciaCatastral: item.rc20,
            referenciaParcela: item.rc20.slice(0, 14),
            cargo: item.rc20.slice(14, 18),
            tipoBien: "UR",
            direccion: {
              tipoVia: "CL",
              via: "UNICA",
              numero: consulta.numero,
              numero2: null,
              bloque: null,
              escalera: null,
              planta: null,
              puerta: null,
              codigoPostal: item.cp,
              provincia: PROVINCIA,
              municipio: MUNICIPIO,
              literal: null,
            },
            superficie: 50,
            anio: 1976,
            uso: "Residencial",
            coeficienteParticipacion: 100,
            finca: null,
            unidades: [],
            raw: null,
          })),
          raw: {},
        };
      },
      consultarReferencia: async (consulta: { refCat: string }) => {
        dnprc += 1;
        return {
          query: {},
          operacion: "Consulta_DNPRC",
          tipo: "detalle",
          control: { inmuebles: 1, construcciones: null, errores: null },
          error: null,
          results: [
            {
              referenciaCatastral: consulta.refCat,
              referenciaParcela: consulta.refCat.slice(0, 14),
              cargo: "0001",
              tipoBien: "UR",
              direccion: {
                tipoVia: "CL",
                via: "UNICA",
                numero: "1",
                numero2: null,
                bloque: null,
                escalera: null,
                planta: null,
                puerta: null,
                codigoPostal: "46388",
                provincia: PROVINCIA,
                municipio: MUNICIPIO,
                literal: null,
              },
              superficie: 50,
              anio: 1976,
              uso: "Residencial",
              coeficienteParticipacion: 100,
              finca: {
                literal: null,
                tipoLiteral: "Parcela construida sin división horizontal",
                superficieSolar: 100,
                urlGrafico: null,
              },
              unidades: [],
              raw: null,
            },
          ],
          raw: {},
        };
      },
      consultarPoligonoParcela: async () => {
        throw new Error("no usado");
      },
      obtenerProvincias: async () => {
        throw new Error("no usado");
      },
      obtenerMunicipios: async () => ({
        consulta_municipieroResult: {
          municipiero: { muni: [{ locat: { cd: "46", cmc: "138" }, nm: MUNICIPIO }] },
        },
      }),
      obtenerCallejero: async () => ({
        consulta_callejeroResult: {
          callejero: { calle: [{ dir: { cv: "1", tv: "CL", nv: "UNICA" } }] },
        },
      }),
      obtenerNumerero: async () => {
        throw new Error("no usado");
      },
      obtenerDireccionesPorCodigoVia: async () =>
        `<gml:FeatureCollection>
          <gml:featureMember><ad:Address><base:localId>46.138.1.1</base:localId>
            <ad:LocatorDesignator><ad:designator>1</ad:designator></ad:LocatorDesignator>
          </ad:Address></gml:featureMember>
          <gml:featureMember><ad:Address><base:localId>46.138.1.2</base:localId>
            <ad:LocatorDesignator><ad:designator>2</ad:designator></ad:LocatorDesignator>
          </ad:Address></gml:featureMember>
        </gml:FeatureCollection>`,
      getStats: () => ({ fetches: 0, cacheHits: 0 }),
    } as CatastroClient;

    const deps = depsFalsas(mundoFalso([]), [calle("1", "UNICA")], {
      client,
      buscar: buscarFincasComerciales,
    });
    const session = await prepararOk(deps);
    const snapshot = await ejecutarHastaTerminar(session, deps);
    assert.deepEqual(
      snapshot.results.map((finca) => finca.fincaReference),
      ["AAAAAAAAAAAAAA"]
    );
    assert.deepEqual(snapshot.results[0]?.propertyReferences, [
      "AAAAAAAAAAAAAA0001AA",
      "AAAAAAAAAAAAAA0002BB",
    ]);
    assert.equal(dnprc, 1);
    assert.equal(snapshot.stats.dnprcAvoidedByPostalCode, 1);
    assert.equal(snapshot.stats.fincasPotentiallyMatchingPostalCode, 1);
    assert.equal(snapshot.stats.propertiesRejectedByPostalCode, 2);
  });
});
