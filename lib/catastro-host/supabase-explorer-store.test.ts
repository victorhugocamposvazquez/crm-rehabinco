import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatastroFincaRecord } from "../catastro/explorer";
import {
  busquedaDesdeFila,
  createSupabaseExplorerStore,
  filaDesdeBusqueda,
  filaDesdeFinca,
  fincaDesdeFila,
  type ExplorerDbClient,
  type ExplorerDbQuery,
  type ExplorerDbResult,
} from "./supabase-explorer-store";

type Fila = Record<string, unknown>;

class FakeQuery implements ExplorerDbQuery<Fila> {
  private filters: Array<{ type: "eq" | "in"; col: string; val: unknown }> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limite?: number;
  private desde?: number;
  private hasta?: number;
  private contar = false;
  private columnas = "*";
  private borrar = false;

  constructor(
    private readonly tablas: Map<string, Map<string, Fila>>,
    private readonly tabla: string
  ) {}

  select(columns?: string, options?: { count?: "exact" }) {
    this.columnas = columns ?? "*";
    this.contar = options?.count === "exact";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", col: column, val: value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: "in", col: column, val: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ col: column, asc: options?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limite = value;
    return this;
  }

  range(from: number, to: number) {
    this.desde = from;
    this.hasta = to;
    return this;
  }

  delete() {
    this.borrar = true;
    return this;
  }

  private filas(): Fila[] {
    let rows = [...(this.tablas.get(this.tabla)?.values() ?? [])];
    rows = rows.filter((row) =>
      this.filters.every((filtro) => {
        if (filtro.type === "eq") return row[filtro.col] === filtro.val;
        return Array.isArray(filtro.val) && filtro.val.includes(row[filtro.col]);
      })
    );
    for (const orden of this.orders) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[orden.col] ?? "");
        const bv = String(b[orden.col] ?? "");
        return orden.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }

  private proyectar(row: Fila): Fila {
    if (this.columnas === "*") return row;
    const out: Fila = {};
    for (const col of this.columnas.split(",").map((item) => item.trim())) {
      out[col] = row[col];
    }
    return out;
  }

  maybeSingle(): Promise<ExplorerDbResult<Fila | null>> {
    const row = this.filas()[0];
    return Promise.resolve({ data: row ? this.proyectar(row) : null, error: null });
  }

  upsert(
    values: unknown,
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ): Promise<ExplorerDbResult<null>> {
    const row = values as Fila;
    if (!this.tablas.has(this.tabla)) this.tablas.set(this.tabla, new Map());
    const tabla = this.tablas.get(this.tabla)!;
    const conflictos = (options?.onConflict ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const existente = [...tabla.entries()].find(([, actual]) =>
      conflictos.every((col) => actual[col] === row[col])
    );
    if (existente) {
      if (!options?.ignoreDuplicates) tabla.set(existente[0], { ...existente[1], ...row });
    } else {
      tabla.set(conflictos.map((col) => String(row[col])).join("|"), { ...row });
    }
    return Promise.resolve({ data: null, error: null });
  }

  then(
    onfulfilled?: (value: ExplorerDbResult<Fila[]>) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) {
    if (this.borrar) {
      const tabla = this.tablas.get(this.tabla);
      const afectadas = this.filas();
      if (tabla) {
        for (const [clave, fila] of [...tabla.entries()]) {
          if (afectadas.includes(fila)) tabla.delete(clave);
        }
      }
      if (this.tabla === "catastro_explorer_searches") {
        const resultados = this.tablas.get("catastro_explorer_search_results");
        if (resultados) {
          const ids = new Set(afectadas.map((fila) => fila.id));
          for (const [clave, fila] of [...resultados.entries()]) {
            if (ids.has(fila.search_id)) resultados.delete(clave);
          }
        }
      }
      return Promise.resolve({ data: [], error: null, count: afectadas.length }).then(
        onfulfilled,
        onrejected
      );
    }
    let rows = this.filas();
    const total = rows.length;
    if (this.desde != null && this.hasta != null) rows = rows.slice(this.desde, this.hasta + 1);
    else if (this.limite != null) rows = rows.slice(0, this.limite);
    return Promise.resolve({
      data: rows.map((row) => this.proyectar(row)),
      error: null,
      count: this.contar ? total : null,
    }).then(onfulfilled, onrejected);
  }
}

function clienteFalso(): { client: ExplorerDbClient; tablas: Map<string, Map<string, Fila>> } {
  const tablas = new Map<string, Map<string, Fila>>();
  return {
    tablas,
    client: {
      from: (table: string) => new FakeQuery(tablas, table),
    },
  };
}

const FINCA: CatastroFincaRecord = {
  fincaReference: "FINCA000000002",
  propertyReferences: ["FINCA0000000020001AA"],
  properties: [],
  portals: ["1"],
  address: { provincia: "VALENCIA", municipio: "GODELLETA", sigla: "CL", via: "DEMO" },
  postalCode: "46388",
  postalCodes: ["46388"],
  horizontalDivision: { status: "NO", confidence: 1, reason: "NO" },
  firstSeenAt: "2026-09-12T10:00:00.000Z",
  lastSeenAt: "2026-09-12T10:00:00.000Z",
};

describe("SupabaseExplorerStore", () => {
  it("mapea finca y búsqueda sin perder identidad de 14", () => {
    const fila = filaDesdeFinca(FINCA);
    assert.equal(fila.finca_reference.length, 14);
    assert.equal(fincaDesdeFila(fila).fincaReference, "FINCA000000002");
    const search = busquedaDesdeFila(
      filaDesdeBusqueda({
        id: "11111111-1111-1111-1111-111111111111",
        ownerId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        criteria: {
          mode: "POSTAL_CODE",
          provincia: "VALENCIA",
          municipio: "GODELLETA",
          postalCode: "46388",
          horizontalDivision: "ALL",
        },
        status: "COMPLETED",
        coverage: { complete: true, completeCandidates: true, possibleCut: false, streetsFound: 3 },
        totals: { fincas: 2, candidates: 1, yes: 0, unknown: 1, notApplicable: 0 },
        createdAt: "2026-09-12T10:00:00.000Z",
        updatedAt: "2026-09-12T11:00:00.000Z",
      })
    );
    assert.equal(search.criteria.mode, "POSTAL_CODE");
    assert.equal(search.totals.candidates, 1);
    assert.equal(search.coverage.streetsFound, 3);
  });

  it("deduplica fincas por upsert y aísla búsquedas por user_id", async () => {
    const { client, tablas } = clienteFalso();
    const store = createSupabaseExplorerStore(client);
    const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const searchA = "11111111-1111-1111-1111-111111111111";
    const searchB = "22222222-2222-2222-2222-222222222222";

    await store.putFinca(FINCA);
    await store.putFinca({ ...FINCA, portals: ["2"], lastSeenAt: "2026-09-12T11:00:00.000Z" });
    assert.equal(tablas.get("catastro_fincas")?.size, 1);

    await store.putSearch({
      id: searchA,
      ownerId: userA,
      criteria: {
        mode: "STREET",
        provincia: "MADRID",
        municipio: "MADRID",
        sigla: "CL",
        via: "FUENCARRAL",
        horizontalDivision: "NO",
      },
      status: "COMPLETED",
      coverage: { complete: true, completeCandidates: true, possibleCut: false },
      totals: { fincas: 1, candidates: 1, yes: 0, unknown: 0, notApplicable: 0 },
      createdAt: "2026-09-12T10:00:00.000Z",
      updatedAt: "2026-09-12T12:00:00.000Z",
    });
    await store.putSearch({
      id: searchB,
      ownerId: userB,
      criteria: {
        mode: "POSTAL_CODE",
        provincia: "VALENCIA",
        municipio: "GODELLETA",
        postalCode: "46388",
        horizontalDivision: "ALL",
      },
      status: "CANCELLED",
      coverage: { complete: false, completeCandidates: false, possibleCut: false, streetsProcessed: 1 },
      totals: { fincas: 0, candidates: 0, yes: 0, unknown: 0, notApplicable: 0 },
      createdAt: "2026-09-12T09:00:00.000Z",
      updatedAt: "2026-09-12T09:30:00.000Z",
    });

    assert.equal((await store.getSearch(searchA, userB)), null);
    assert.equal((await store.listRecentSearches(userA, 5))[0]?.id, searchA);
    assert.equal((await store.listRecentSearches(userB, 5))[0]?.status, "CANCELLED");

    await store.putSearchResult({
      searchId: searchA,
      fincaReference: FINCA.fincaReference,
      discoveredAt: "2026-09-12T10:01:00.000Z",
      classificationAtDiscovery: { status: "NO" },
    });
    await store.putSearchResult({
      searchId: searchA,
      fincaReference: FINCA.fincaReference,
      discoveredAt: "2026-09-12T10:02:00.000Z",
      classificationAtDiscovery: { status: "YES" },
    });
    const pagina = await store.listResultsPage(searchA, { limit: 10, offset: 0 });
    assert.equal(pagina.total, 1);
    assert.equal(pagina.items[0]?.discoveredAt, "2026-09-12T10:01:00.000Z");

    await store.putReview({
      userId: userA,
      fincaReference: FINCA.fincaReference,
      status: "REVIEW",
      updatedAt: "2026-09-12T12:00:00.000Z",
    });
    assert.equal((await store.getReview(userB, FINCA.fincaReference)), null);
    assert.equal((await store.getReview(userA, FINCA.fincaReference))?.status, "REVIEW");

    assert.equal(await store.deleteSearch(searchA, userB), false);
    assert.equal((await store.getSearch(searchA, userA))?.id, searchA);
    assert.equal(await store.deleteSearch(searchA, userA), true);
    assert.equal(await store.getSearch(searchA, userA), null);
    assert.equal((await store.listResultsBySearch(searchA)).length, 0);
    assert.equal(tablas.get("catastro_fincas")?.size, 1);
    assert.equal((await store.getReview(userA, FINCA.fincaReference))?.status, "REVIEW");
    assert.equal((await store.listSearches(userB, { limit: 10, offset: 0 })).items[0]?.id, searchB);
  });
});
