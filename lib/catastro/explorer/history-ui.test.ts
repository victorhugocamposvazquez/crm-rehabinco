import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { etiquetaEstadoDivision } from "../search-ui";
import { copiarAlPortapapeles, direccionOficial, SELECCION_VACIA } from "../selection-export";
import { ordenarBusquedasRecientes, crearBusqueda, actualizarBusqueda } from "./model";
import {
  CLASES_TARJETA_BUSQUEDA,
  ERROR_BUSQUEDA_404,
  ERROR_FINCA_404,
  ERROR_HISTORICO,
  ERROR_RECIENTES,
  RUTA_EXPLORER,
  RUTA_HISTORICO,
  RUTA_NUEVA_BUSQUEDA,
  TEXTO_CONFIRMAR_ELIMINAR,
  TEXTO_VER_TODO,
  eliminarBusquedaUi,
  esUrlHistorica,
  fetchHistoricoBusquedas,
  paramsHistoricoBusquedas,
  criteriosVisibles,
  etiquetaTipoBusqueda,
  fetchBusquedaPersistida,
  fetchBusquedasRecientes,
  fetchFincaPersistida,
  crearPropiedadDesdeFincaUi,
  filtrarFincasHistoricas,
  fincaUiDesdeRecord,
  llamaACatastro,
  prepararExportacionHistorica,
  revisionDesdePersistida,
  rutaBusquedaHistorica,
  rutaFincaPersistida,
  textosCoberturaHistorica,
} from "./history-ui";
import type { CatastroExplorerReview } from "./types";
import type { FincaBusquedaUi } from "../search-ui";

const originalFetch = globalThis.fetch;
const urls: string[] = [];

afterEach(() => {
  globalThis.fetch = originalFetch;
  urls.length = 0;
});

function fincaUi(
  ref: string,
  status: string,
  extra: Partial<FincaBusquedaUi> = {}
): FincaBusquedaUi {
  return {
    fincaReference: ref,
    portals: ["3"],
    address: {
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "GUAYANA-MOJONERA",
      numero: "3",
    },
    postalCode: "46388",
    postalCodes: ["46388"],
    horizontalDivision: { status, ...(status === "UNKNOWN" ? { reasonCode: "MIXED_URBAN_RURAL" } : {}) },
    properties: [
      {
        reference: `${ref}0001DI`,
        superficie: 120,
        anio: 1980,
        uso: "Residencial",
        postalCode: "46388",
      },
    ],
    ...extra,
  };
}

const GODELLETA_3 = fincaUi("2749704YJ0624N", "NO");
const UNKNOWN = fincaUi("UNKNOWN0000001", "UNKNOWN");
const SUELO = fincaUi("SUELO000000001", "NOT_APPLICABLE");
const YES = fincaUi("YES00000000001", "YES");

function mockFetch(handler: (url: string) => { status: number; body: unknown }) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

describe("Catastro Explorer — experiencia persistente", () => {
  it("1. las rutas profundas del módulo son estables", () => {
    assert.equal(RUTA_EXPLORER, "/catastro");
    assert.equal(RUTA_NUEVA_BUSQUEDA, "/catastro");
    assert.equal(rutaBusquedaHistorica("abc"), "/catastro/searches/abc");
    assert.equal(rutaFincaPersistida("2749704YJ0624N"), "/catastro/finca/2749704YJ0624N");
    assert.equal(rutaBusquedaHistorica("abc").includes("cursor"), false);
    assert.equal(RUTA_HISTORICO, "/catastro/searches");
    assert.equal(TEXTO_VER_TODO, "Ver todo");
    assert.match(TEXTO_CONFIRMAR_ELIMINAR, /Las fincas descubiertas no se eliminarán/);
  });

  it("el histórico paginado no usa cursor de Catastro ni carga fincas", async () => {
    mockFetch(() => ({
      status: 200,
      body: { ok: true, searches: [{ id: "s1", mode: "STREET" }], total: 21, limit: 20, offset: 0 },
    }));
    const data = await fetchHistoricoBusquedas({ limit: 20, offset: 0, mode: "STREET" });
    assert.equal(urls[0], "/api/catastro/searches?limit=20&offset=0&mode=STREET");
    assert.equal(urls[0].includes("cursor"), false);
    assert.equal(llamaACatastro(urls[0]), false);
    assert.equal(data.total, 21);
    assert.equal(paramsHistoricoBusquedas({ mode: "ALL" }).includes("mode="), false);
  });

  it("eliminar una búsqueda ajena se presenta como 404", async () => {
    mockFetch(() => ({ status: 404, body: { ok: false, error: "Búsqueda no encontrada." } }));
    await assert.rejects(() => eliminarBusquedaUi("ajena"), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, ERROR_BUSQUEDA_404);
      return true;
    });
    assert.equal(urls[0], "/api/catastro/searches/ajena");
  });

  it("un fallo del histórico usa mensaje humano", async () => {
    mockFetch(() => ({ status: 500, body: { ok: false, error: "ECONNRESET" } }));
    await assert.rejects(() => fetchHistoricoBusquedas(), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, ERROR_HISTORICO);
      return true;
    });
  });

  it("2 y 3. carga recientes y respeta el orden por fecha del store", async () => {
    const godelleta = actualizarBusqueda(
      crearBusqueda({
        id: "zona-cp",
        now: "2026-09-12T10:00:00.000Z",
        criteria: {
          mode: "POSTAL_CODE",
          provincia: "VALENCIA",
          municipio: "GODELLETA",
          postalCode: "46388",
          horizontalDivision: "ALL",
        },
      }),
      { status: "COMPLETED", now: "2026-09-12T18:00:00.000Z" }
    );
    const calle = actualizarBusqueda(
      crearBusqueda({
        id: "calle-3",
        now: "2026-09-11T08:00:00.000Z",
        criteria: {
          mode: "STREET",
          provincia: "VALENCIA",
          municipio: "GODELLETA",
          sigla: "CL",
          via: "GUAYANA-MOJONERA",
          numero: "3",
          horizontalDivision: "ALL",
        },
      }),
      { now: "2026-09-11T12:00:00.000Z" }
    );
    const ordenadas = ordenarBusquedasRecientes([calle, godelleta]);
    assert.deepEqual(
      ordenadas.map((item) => item.id),
      ["zona-cp", "calle-3"]
    );

    mockFetch(() => ({
      status: 200,
      body: {
        ok: true,
        searches: ordenadas.map((search) => ({
          id: search.id,
          mode: search.criteria.mode,
          titulo: search.criteria.mode === "POSTAL_CODE" ? "Godelleta · CP 46388" : "Godelleta · CL GUAYANA-MOJONERA 3",
          fincas: search.criteria.mode === "POSTAL_CODE" ? 3031 : 1,
          candidatas: search.criteria.mode === "POSTAL_CODE" ? 1888 : 0,
          status: search.status,
          updatedAt: search.updatedAt,
        })),
      },
    }));
    const recientes = await fetchBusquedasRecientes();
    assert.equal(urls[0], "/api/catastro/searches/recent?limit=20");
    assert.equal(llamaACatastro(urls[0]), false);
    assert.equal(recientes[0].id, "zona-cp");
    assert.equal(recientes[0].fincas, 3031);
    assert.equal(etiquetaTipoBusqueda(recientes[0].mode), "Código postal");
    assert.equal(etiquetaTipoBusqueda(recientes[1].mode), "Calle");
  });

  it("4. abrir una búsqueda usa la ruta histórica", () => {
    assert.equal(rutaBusquedaHistorica("search-godelleta"), "/catastro/searches/search-godelleta");
  });

  it("5. recupera resultados con limit/offset, no con cursor de Catastro", async () => {
    mockFetch(() => ({
      status: 200,
      body: {
        ok: true,
        search: { id: "s1", ownerId: "hugo" },
        summary: { id: "s1" },
        results: { items: [], fincas: [GODELLETA_3], total: 80, limit: 50, offset: 50 },
        reviews: [],
      },
    }));
    const data = await fetchBusquedaPersistida("s1", { limit: 50, offset: 50 });
    assert.match(urls[0], /\/api\/catastro\/searches\/s1\?limit=50&offset=50/);
    assert.equal(urls[0].includes("cursor"), false);
    assert.equal(llamaACatastro(urls[0]), false);
    assert.equal(data.results.offset, 50);
    assert.equal(data.results.fincas[0].fincaReference, "2749704YJ0624N");
  });

  it("6. el filtro local no mezcla candidatos, UNKNOWN y NOT_APPLICABLE", () => {
    const fincas = [GODELLETA_3, UNKNOWN, SUELO, YES];
    const revision = revisionDesdePersistida("h", fincas, [
      { userId: "hugo", fincaReference: UNKNOWN.fincaReference, status: "REVIEW", updatedAt: "2026-09-12" },
    ], "hugo");
    assert.deepEqual(
      filtrarFincasHistoricas(fincas, "CANDIDATES", revision).map((f) => f.fincaReference),
      ["2749704YJ0624N"]
    );
    assert.deepEqual(
      filtrarFincasHistoricas(fincas, "UNKNOWN", revision).map((f) => f.fincaReference),
      [UNKNOWN.fincaReference]
    );
    assert.deepEqual(
      filtrarFincasHistoricas(fincas, "NOT_APPLICABLE", revision).map((f) => f.fincaReference),
      [SUELO.fincaReference]
    );
    assert.deepEqual(
      filtrarFincasHistoricas(fincas, "REVIEW", revision).map((f) => f.fincaReference),
      [UNKNOWN.fincaReference]
    );
    assert.equal(etiquetaEstadoDivision("NO"), "SIN DIVISIÓN HORIZONTAL");
    assert.equal(etiquetaEstadoDivision("UNKNOWN"), "NO DETERMINADO");
    assert.equal(etiquetaEstadoDivision("NOT_APPLICABLE"), "NO APLICA");
  });

  it("7 y 17. REVIEW es por usuario y no cambia la clasificación", () => {
    const reviews: CatastroExplorerReview[] = [
      { userId: "hugo", fincaReference: UNKNOWN.fincaReference, status: "REVIEW", updatedAt: "2026-09-12" },
      { userId: "rocio", fincaReference: UNKNOWN.fincaReference, status: "NONE", updatedAt: "2026-09-12" },
    ];
    const deHugo = revisionDesdePersistida("h", [UNKNOWN], reviews, "hugo");
    const deRocio = revisionDesdePersistida("h", [UNKNOWN], reviews, "rocio");
    assert.equal(deHugo.fincas.length, 1);
    assert.equal(deRocio.fincas.length, 0);
    assert.equal(UNKNOWN.horizontalDivision?.status, "UNKNOWN");
    assert.notEqual(UNKNOWN.horizontalDivision?.status, "NO");
  });

  it("8. el detalle reconstruye la finca persistida", () => {
    const ui = fincaUiDesdeRecord({
      fincaReference: "2749704YJ0624N",
      propertyReferences: ["2749704YJ0624N0001DI"],
      properties: GODELLETA_3.properties ?? [],
      portals: ["3"],
      address: {
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        sigla: "CL",
        via: "GUAYANA-MOJONERA",
        numero: "3",
      },
      postalCode: "46388",
      postalCodes: ["46388"],
      superficieSolar: 210,
      horizontalDivision: { status: "NO", confidence: 1, reason: "NO" },
    });
    assert.equal(ui.fincaReference, "2749704YJ0624N");
    assert.equal(ui.horizontalDivision?.status, "NO");
    assert.equal(ui.portals[0], "3");
    assert.equal(ui.properties?.[0]?.reference, "2749704YJ0624N0001DI");
  });

  it("9. abrir históricos no llama a Catastro", async () => {
    mockFetch((url) => {
      if (url.includes("/searches/recent")) return { status: 200, body: { ok: true, searches: [] } };
      if (url.includes("/searches/")) return { status: 200, body: { ok: true, search: {}, summary: {}, results: { items: [], fincas: [], total: 0, limit: 50, offset: 0 }, reviews: [] } };
      if (url.includes("/fincas/")) return { status: 200, body: { ok: true, finca: GODELLETA_3, review: null } };
      return { status: 500, body: { ok: false } };
    });
    await fetchBusquedasRecientes();
    await fetchBusquedaPersistida("s1", { limit: 20, offset: 0 });
    await fetchFincaPersistida("2749704YJ0624N");
    assert.equal(urls.every((url) => !llamaACatastro(url)), true);
    assert.equal(urls.some((url) => url.includes("/api/catastro/search?")), false);
    assert.equal(urls.some((url) => url.includes("/api/catastro/zone")), false);
  });

  it("11 y 12. copiar referencia y dirección usa las funciones existentes", async () => {
    const copiados: string[] = [];
    assert.equal(await copiarAlPortapapeles(GODELLETA_3.fincaReference, async (texto) => { copiados.push(texto); }), true);
    assert.equal(direccionOficial(GODELLETA_3), "CL GUAYANA-MOJONERA 3");
    assert.equal(await copiarAlPortapapeles(direccionOficial(GODELLETA_3), async (texto) => { copiados.push(texto); }), true);
    assert.deepEqual(copiados, ["2749704YJ0624N", "CL GUAYANA-MOJONERA 3"]);
  });

  it("13. la exportación histórica reutiliza el CSV persistido", () => {
    const csv = prepararExportacionHistorica({
      fincas: [GODELLETA_3],
      seleccion: SELECCION_VACIA,
      criterios: { municipio: "GODELLETA", via: "GUAYANA-MOJONERA", numero: "3", horizontalDivision: "ALL" },
      cobertura: { completeCandidates: true, possibleCut: false },
      fecha: new Date("2026-09-12T12:00:00.000Z"),
    });
    assert.equal(csv.ok, true);
    if (!csv.ok) return;
    assert.match(csv.contenido, /2749704YJ0624N/);
    assert.match(csv.contenido, /GUAYANA-MOJONERA/);
    assert.equal(csv.contenido.includes("SIN DIVISIÓN HORIZONTAL"), true);
  });

  it("14. 404 de búsqueda y de finca no muestran errores técnicos", async () => {
    mockFetch(() => ({ status: 404, body: { ok: false, error: "relation does not exist" } }));
    await assert.rejects(() => fetchBusquedaPersistida("missing"), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, ERROR_BUSQUEDA_404);
      assert.equal(err.message.includes("relation"), false);
      return true;
    });
    await assert.rejects(() => fetchFincaPersistida("XXXXXXXXXXXXXX"), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, ERROR_FINCA_404);
      return true;
    });
  });

  it("15. un fallo de recientes usa el mensaje humano", async () => {
    mockFetch(() => ({ status: 500, body: { ok: false, error: "ECONNRESET" } }));
    await assert.rejects(() => fetchBusquedasRecientes(), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, ERROR_RECIENTES);
      assert.equal(err.message.includes("ECONNRESET"), false);
      return true;
    });
  });

  it("16. la tarjeta de búsqueda es responsive", () => {
    assert.match(CLASES_TARJETA_BUSQUEDA, /flex-col/);
    assert.match(CLASES_TARJETA_BUSQUEDA, /sm:flex-row/);
    assert.match(CLASES_TARJETA_BUSQUEDA, /sm:p-5/);
  });

  it("muestra cobertura sin inventar recortes", () => {
    assert.deepEqual(textosCoberturaHistorica({ complete: true, possibleCut: false }), {
      estado: "Búsqueda completa",
      corte: null,
    });
    assert.deepEqual(textosCoberturaHistorica({ complete: false, possibleCut: true }), {
      estado: "Búsqueda incompleta",
      corte: "Cobertura potencialmente incompleta por limitación de Catastro.",
    });
  });

  it("los criterios visibles son los guardados", () => {
    const calle = criteriosVisibles({
      mode: "STREET",
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "GUAYANA-MOJONERA",
      numero: "3",
      horizontalDivision: "ALL",
    });
    assert.deepEqual(
      calle.map((item) => item.label),
      ["Provincia", "Municipio", "Calle", "Número", "Filtro de división horizontal"]
    );
    const cp = criteriosVisibles({
      mode: "POSTAL_CODE",
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      postalCode: "46388",
      horizontalDivision: "NO",
    });
    assert.equal(cp.find((item) => item.label === "CP")?.value, "46388");
  });

  it("crear Property usa el endpoint de finca y no llama a Catastro", async () => {
    mockFetch((url) => {
      assert.equal(url, "/api/catastro/fincas/2749704YJ0624N/property");
      return {
        status: 200,
        body: {
          ok: true,
          created: true,
          link: {
            fincaReference: "2749704YJ0624N",
            propertyId: "prop-1",
            source: "CATASTRO_EXPLORER",
            linkedAt: "2026-09-12T11:00:00.000Z",
          },
        },
      };
    });
    const resultado = await crearPropiedadDesdeFincaUi("2749704YJ0624N", "cliente-1");
    assert.equal(resultado.created, true);
    assert.equal(resultado.link.fincaReference, "2749704YJ0624N");
    assert.equal(llamaACatastro(urls[0]), false);
    assert.equal(esUrlHistorica(urls[0]), true);
  });
});
