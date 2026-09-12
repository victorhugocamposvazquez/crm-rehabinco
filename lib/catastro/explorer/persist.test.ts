import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { FincaDescubierta } from "../finca";
import {
  crearBusqueda,
  crearStoreMemoriaExplorer,
  consultaHistoricoBusquedas,
  eliminarBusqueda,
  persistirBusqueda,
  persistirRevision,
  propuestaBusqueda,
  registrarDescubrimiento,
} from "./index";
import type { CatastroExplorerSearchCriteria, CatastroFinca } from "./types";

function finca(
  ref14: string,
  status: FincaDescubierta["horizontalDivision"]["status"] = "NO",
  extra: Partial<FincaDescubierta> = {}
): CatastroFinca {
  return {
    fincaReference: ref14,
    propertyReferences: [`${ref14}0001AA`],
    properties: [],
    portals: ["1"],
    address: {
      provincia: "VALENCIA",
      municipio: "GODELLETA",
      sigla: "CL",
      via: "DEMO",
      numero: "1",
    },
    postalCode: "46388",
    postalCodes: ["46388"],
    horizontalDivision: {
      status,
      confidence: status === "UNKNOWN" ? 0 : 1,
      reason: status,
      ...(status === "UNKNOWN" ? { reasonCode: "MIXED_URBAN_RURAL" as const } : {}),
    },
    ...extra,
  };
}

const FINCA_001 = finca("FINCA000000001");
const FINCA_002 = finca("FINCA000000002", "UNKNOWN");
const FINCA_003 = finca("FINCA000000003", "YES");

const CALLE: CatastroExplorerSearchCriteria = {
  mode: "STREET",
  provincia: "MADRID",
  municipio: "MADRID",
  sigla: "CL",
  via: "FUENCARRAL",
  horizontalDivision: "ALL",
};

const ZONA: CatastroExplorerSearchCriteria = {
  mode: "POSTAL_CODE",
  provincia: "VALENCIA",
  municipio: "GODELLETA",
  postalCode: "46388",
  horizontalDivision: "ALL",
};

describe("Catastro Explorer — persistencia", () => {
  it("1 y 2. crea y recupera una búsqueda", async () => {
    const store = crearStoreMemoriaExplorer();
    const creada = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "search-a",
        ownerId: "user-a",
        criteria: ZONA,
        status: "RUNNING",
        coverage: { complete: false, completeCandidates: false, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-12T10:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-12T10:00:00.000Z"
    );
    const recuperada = await store.getSearch("search-a", "user-a");
    assert.equal(recuperada?.id, "search-a");
    assert.equal(recuperada?.ownerId, "user-a");
    assert.equal(recuperada?.criteria.mode, "POSTAL_CODE");
    assert.equal(creada.totals.fincas, 1);
    assert.equal(recuperada?.totals.fincas, 1);
  });

  it("3. búsquedas recientes por updatedAt DESC sin cargar resultados", async () => {
    const store = crearStoreMemoriaExplorer();
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "antigua",
        ownerId: "user-a",
        criteria: CALLE,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-11T12:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-11T12:00:00.000Z"
    );
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "nueva",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: {
          complete: true,
          completeCandidates: true,
          possibleCut: false,
          streetsFound: 3,
          streetsProcessed: 3,
          streetsWithErrors: 0,
        },
        fincas: [FINCA_001, FINCA_002],
        now: "2026-09-12T18:00:00.000Z",
      }),
      [FINCA_001, FINCA_002],
      "2026-09-12T18:00:00.000Z"
    );
    const recientes = await store.listRecentSearches("user-a", 10);
    assert.deepEqual(
      recientes.map((item) => item.id),
      ["nueva", "antigua"]
    );
    assert.equal(recientes[0]?.totals.fincas, 2);
    assert.equal(recientes[0]?.totals.candidates, 1);
  });

  it("4 y 11. crea/actualiza finca y lastSeenAt", async () => {
    const store = crearStoreMemoriaExplorer();
    const search = crearBusqueda({
      id: "s1",
      ownerId: "user-a",
      now: "2026-09-12T10:00:00.000Z",
      criteria: CALLE,
    });
    await store.putSearch(search);
    const primero = await registrarDescubrimiento(store, search, FINCA_001, "2026-09-12T10:00:00.000Z");
    const segundo = await registrarDescubrimiento(
      store,
      search,
      { ...FINCA_001, portals: ["9"] },
      "2026-09-12T11:00:00.000Z"
    );
    assert.equal(primero.finca.firstSeenAt, "2026-09-12T10:00:00.000Z");
    assert.equal(segundo.finca.firstSeenAt, "2026-09-12T10:00:00.000Z");
    assert.equal(segundo.finca.lastSeenAt, "2026-09-12T11:00:00.000Z");
    assert.deepEqual((await store.getFinca(FINCA_001.fincaReference))?.portals, ["1", "9"]);
  });

  it("5, 6 y 7. deduplica 14 caracteres: 3 fincas y 4 SearchResult", async () => {
    const store = crearStoreMemoriaExplorer();
    const a = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "search-a",
        ownerId: "user-a",
        criteria: CALLE,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001, FINCA_002],
        now: "2026-09-12T10:00:00.000Z",
      }),
      [FINCA_001, FINCA_002],
      "2026-09-12T10:00:00.000Z"
    );
    const b = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "search-b",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_002, FINCA_003],
        now: "2026-09-12T11:00:00.000Z",
      }),
      [FINCA_002, FINCA_003],
      "2026-09-12T11:00:00.000Z"
    );
    const fincas = await store.getFincas([
      FINCA_001.fincaReference,
      FINCA_002.fincaReference,
      FINCA_003.fincaReference,
    ]);
    assert.equal(fincas.length, 3);
    const resultsA = await store.listResultsBySearch(a.id);
    const resultsB = await store.listResultsBySearch(b.id);
    assert.equal(resultsA.length, 2);
    assert.equal(resultsB.length, 2);
    assert.equal((await store.listResultsByFinca(FINCA_002.fincaReference)).length, 2);
    assert.equal((await store.getSearchResult(a.id, FINCA_001.fincaReference))?.searchId, "search-a");
  });

  it("8. Review es por usuario y no cambia UNKNOWN", async () => {
    const store = crearStoreMemoriaExplorer();
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "search-a",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_002],
        now: "2026-09-12T10:00:00.000Z",
      }),
      [FINCA_002],
      "2026-09-12T10:00:00.000Z"
    );
    await persistirRevision(store, {
      userId: "user-a",
      fincaReference: FINCA_002.fincaReference,
      status: "REVIEW",
      now: "2026-09-12T10:05:00.000Z",
    });
    await persistirRevision(store, {
      userId: "user-b",
      fincaReference: FINCA_002.fincaReference,
      status: "NONE",
      now: "2026-09-12T10:06:00.000Z",
    });
    assert.equal((await store.getReview("user-a", FINCA_002.fincaReference))?.status, "REVIEW");
    assert.equal((await store.getReview("user-b", FINCA_002.fincaReference))?.status, "NONE");
    assert.equal((await store.getFinca(FINCA_002.fincaReference))?.horizontalDivision.status, "UNKNOWN");
  });

  it("9. aísla búsquedas entre usuarios", async () => {
    const store = crearStoreMemoriaExplorer();
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "de-a",
        ownerId: "user-a",
        criteria: CALLE,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-12T10:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-12T10:00:00.000Z"
    );
    assert.equal(await store.getSearch("de-a", "user-b"), null);
    assert.deepEqual(await store.listRecentSearches("user-b", 10), []);
    assert.equal((await store.getSearch("de-a", "user-a"))?.ownerId, "user-a");
  });

  it("10. el contrato RLS vive en la migración (no en el frontend)", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../supabase/migrations/20260912195717_catastro_explorer_persistencia.sql"
      ),
      "utf8"
    );
    assert.match(sql, /enable row level security/);
    assert.match(sql, /auth\.uid\(\) = user_id/);
    assert.match(sql, /Usuario lee sus busquedas catastro/);
    assert.match(sql, /Usuario lee resultados de sus busquedas/);
    assert.match(sql, /catastro_explorer_search_results\.search_id/);
    assert.match(sql, /Usuario lee sus revisiones catastro/);
    assert.match(sql, /finca_reference text primary key/);
    assert.doesNotMatch(sql, /create table public\.clientes/);
  });

  it("12 y 15. POSTAL_CODE persiste coverage de zona", async () => {
    const store = crearStoreMemoriaExplorer();
    const search = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "zona-godelleta",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: {
          complete: true,
          completeCandidates: true,
          possibleCut: false,
          streetsFound: 12,
          streetsProcessed: 12,
          streetsWithErrors: 0,
        },
        fincas: [FINCA_001, FINCA_002, FINCA_003],
        now: "2026-09-12T18:00:00.000Z",
      }),
      [FINCA_001, FINCA_002, FINCA_003],
      "2026-09-12T18:00:00.000Z"
    );
    assert.equal(search.criteria.mode, "POSTAL_CODE");
    assert.equal(search.coverage.streetsFound, 12);
    assert.equal(search.coverage.complete, true);
    assert.equal(search.totals.fincas, 3);
    assert.equal(search.totals.candidates, 1);
    assert.equal(search.totals.unknown, 1);
    assert.equal(search.totals.yes, 1);
  });

  it("13 y 14. STREET persiste totals", async () => {
    const store = crearStoreMemoriaExplorer();
    const search = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "calle-fuencarral",
        ownerId: "user-a",
        criteria: CALLE,
        status: "RUNNING",
        coverage: {
          complete: false,
          completeCandidates: false,
          possibleCut: true,
          portalsFound: 40,
          portalsProcessed: 20,
        },
        fincas: [FINCA_001, FINCA_003],
        now: "2026-09-12T09:00:00.000Z",
      }),
      [FINCA_001, FINCA_003],
      "2026-09-12T09:00:00.000Z"
    );
    assert.equal(search.criteria.mode, "STREET");
    assert.equal(search.totals.fincas, 2);
    assert.equal(search.totals.candidates, 1);
    assert.equal(search.coverage.portalsProcessed, 20);
  });

  it("16 y 17. cancelada y completada quedan registradas", async () => {
    const store = crearStoreMemoriaExplorer();
    const cancelada = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "cancelada",
        ownerId: "user-a",
        criteria: ZONA,
        status: "CANCELLED",
        coverage: {
          complete: false,
          completeCandidates: false,
          possibleCut: false,
          streetsFound: 10,
          streetsProcessed: 3,
          streetsWithErrors: 0,
        },
        fincas: [FINCA_001],
        now: "2026-09-12T10:30:00.000Z",
      }),
      [FINCA_001],
      "2026-09-12T10:30:00.000Z"
    );
    const completada = await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "completada",
        ownerId: "user-a",
        criteria: CALLE,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-12T11:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-12T11:00:00.000Z"
    );
    assert.equal(cancelada.status, "CANCELLED");
    assert.equal(cancelada.completedAt, "2026-09-12T10:30:00.000Z");
    assert.equal(completada.status, "COMPLETED");
    assert.equal(completada.completedAt, "2026-09-12T11:00:00.000Z");
  });

  it("18. pagina resultados sin devolver todas las fincas", async () => {
    const store = crearStoreMemoriaExplorer();
    const fincas = [FINCA_001, FINCA_002, FINCA_003];
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "paginada",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas,
        now: "2026-09-12T12:00:00.000Z",
      }),
      fincas,
      "2026-09-12T12:00:00.000Z"
    );
    const pagina = await store.listResultsPage("paginada", { limit: 2, offset: 0 });
    const siguiente = await store.listResultsPage("paginada", { limit: 2, offset: 2 });
    assert.equal(pagina.total, 3);
    assert.equal(pagina.items.length, 2);
    assert.equal(siguiente.items.length, 1);
    assert.equal(siguiente.offset, 2);
  });

  it("elimina búsqueda y resultados sin borrar finca ni review", async () => {
    const store = crearStoreMemoriaExplorer();
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "borrar",
        ownerId: "user-a",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001, FINCA_002],
        now: "2026-09-12T10:00:00.000Z",
      }),
      [FINCA_001, FINCA_002],
      "2026-09-12T10:00:00.000Z"
    );
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "conservar",
        ownerId: "user-a",
        criteria: CALLE,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-12T11:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-12T11:00:00.000Z"
    );
    await persistirRevision(store, {
      userId: "user-a",
      fincaReference: FINCA_002.fincaReference,
      status: "REVIEW",
      now: "2026-09-12T10:05:00.000Z",
    });
    assert.equal(await eliminarBusqueda(store, "borrar", "user-b"), "not_found");
    assert.equal((await store.getSearch("borrar", "user-a"))?.id, "borrar");
    assert.equal(await eliminarBusqueda(store, "borrar", "user-a"), "deleted");
    assert.equal(await store.getSearch("borrar", "user-a"), null);
    assert.equal((await store.listResultsBySearch("borrar")).length, 0);
    assert.equal((await store.listResultsBySearch("conservar")).length, 1);
    assert.equal((await store.getFinca(FINCA_001.fincaReference))?.fincaReference, FINCA_001.fincaReference);
    assert.equal((await store.getFinca(FINCA_002.fincaReference))?.horizontalDivision.status, "UNKNOWN");
    assert.equal((await store.getReview("user-a", FINCA_002.fincaReference))?.status, "REVIEW");
  });

  it("lista el histórico paginado del usuario, sin resultados", async () => {
    const store = crearStoreMemoriaExplorer();
    for (let i = 0; i < 3; i += 1) {
      await persistirBusqueda(
        store,
        propuestaBusqueda({
          id: `h${i}`,
          ownerId: "user-a",
          criteria: i === 1 ? CALLE : ZONA,
          status: "COMPLETED",
          coverage: { complete: true, completeCandidates: true, possibleCut: false },
          fincas: [FINCA_001],
          now: `2026-09-1${i}T10:00:00.000Z`,
        }),
        [FINCA_001],
        `2026-09-1${i}T10:00:00.000Z`
      );
    }
    await persistirBusqueda(
      store,
      propuestaBusqueda({
        id: "ajena",
        ownerId: "user-b",
        criteria: ZONA,
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false },
        fincas: [FINCA_001],
        now: "2026-09-19T10:00:00.000Z",
      }),
      [FINCA_001],
      "2026-09-19T10:00:00.000Z"
    );
    const pagina = await store.listSearches("user-a", { limit: 2, offset: 0 });
    assert.equal(pagina.total, 3);
    assert.deepEqual(
      pagina.items.map((item) => item.id),
      ["h2", "h1"]
    );
    const siguiente = await store.listSearches("user-a", { limit: 2, offset: 2 });
    assert.deepEqual(
      siguiente.items.map((item) => item.id),
      ["h0"]
    );
    const calles = await store.listSearches("user-a", consultaHistoricoBusquedas({ mode: "STREET" }));
    assert.deepEqual(
      calles.items.map((item) => item.id),
      ["h1"]
    );
    assert.equal((await store.listSearches("user-b", { limit: 20, offset: 0 })).items[0]?.id, "ajena");
  });
});
