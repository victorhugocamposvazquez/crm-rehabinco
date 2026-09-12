/**
 * Adaptador de persistencia. Fuera del dominio Catastro Explorer.
 * Sustituible por PostgresExplorerStore / RESTExplorerStore / LocalExplorerStore.
 */
import type { EstadoDhFinca } from "../catastro/applicability";
import type { FiltroDivisionHorizontal } from "../catastro/candidates";
import type {
  CatastroExplorerCoverage,
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchCriteria,
  CatastroExplorerSearchResult,
  CatastroFincaRecord,
  ExplorerStore,
} from "../catastro/explorer";
import type { EstadoRevision } from "../catastro/revision-comercial";
import type { UnknownReason } from "../catastro/unknown-reason";

export type ExplorerDbError = { message: string } | null;

export type ExplorerDbResult<T> = {
  data: T;
  error: ExplorerDbError;
  count?: number | null;
};

export type ExplorerDbQuery<T> = {
  select: (columns?: string, options?: { count?: "exact" }) => ExplorerDbQuery<T>;
  eq: (column: string, value: unknown) => ExplorerDbQuery<T>;
  in: (column: string, values: unknown[]) => ExplorerDbQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => ExplorerDbQuery<T>;
  limit: (value: number) => ExplorerDbQuery<T>;
  range: (from: number, to: number) => ExplorerDbQuery<T>;
  delete: () => ExplorerDbQuery<T>;
  maybeSingle: () => Promise<ExplorerDbResult<T | null>>;
  upsert: (
    values: unknown,
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) => Promise<ExplorerDbResult<null>>;
  then: (
    onfulfilled?: (value: ExplorerDbResult<T[]>) => unknown,
    onrejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
};

export type ExplorerDbClient = {
  from: (table: string) => ExplorerDbQuery<Record<string, unknown>>;
};

export type FincaRow = {
  finca_reference: string;
  property_references: string[];
  properties: unknown;
  portals: string[];
  address: unknown;
  postal_code: string | null;
  postal_codes: string[];
  ltp: string | null;
  superficie_solar: number | null;
  dh_status: EstadoDhFinca;
  dh_confidence: number;
  dh_reason: string;
  dh_reason_code: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type SearchRow = {
  id: string;
  user_id: string;
  mode: "STREET" | "POSTAL_CODE";
  status: CatastroExplorerSearch["status"];
  provincia: string;
  municipio: string;
  sigla: string | null;
  via: string | null;
  numero: string | null;
  postal_code: string | null;
  horizontal_division: FiltroDivisionHorizontal;
  coverage: unknown;
  totals_fincas: number;
  totals_candidates: number;
  totals_yes: number;
  totals_unknown: number;
  totals_not_applicable: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ResultRow = {
  search_id: string;
  finca_reference: string;
  discovered_at: string;
  classification_status: EstadoDhFinca;
  classification_reason_code: string | null;
  postal_code_matched: string | null;
  portals_at_discovery: string[];
};

export type ReviewRow = {
  user_id: string;
  finca_reference: string;
  status: EstadoRevision;
  updated_at: string;
};

function fallo(error: ExplorerDbError): never {
  throw new Error(error?.message ?? "Error de persistencia de Catastro Explorer.");
}

async function ejecutar<T>(promesa: Promise<ExplorerDbResult<T>>): Promise<T> {
  const resultado = await promesa;
  if (resultado.error) fallo(resultado.error);
  return resultado.data;
}

export function filaDesdeFinca(finca: CatastroFincaRecord): FincaRow {
  return {
    finca_reference: finca.fincaReference,
    property_references: finca.propertyReferences,
    properties: finca.properties,
    portals: finca.portals,
    address: finca.address,
    postal_code: finca.postalCode ?? null,
    postal_codes: finca.postalCodes,
    ltp: finca.ltp ?? null,
    superficie_solar: finca.superficieSolar ?? null,
    dh_status: finca.horizontalDivision.status,
    dh_confidence: finca.horizontalDivision.confidence,
    dh_reason: finca.horizontalDivision.reason,
    dh_reason_code: finca.horizontalDivision.reasonCode ?? null,
    first_seen_at: finca.firstSeenAt,
    last_seen_at: finca.lastSeenAt,
  };
}

export function fincaDesdeFila(row: FincaRow): CatastroFincaRecord {
  return {
    fincaReference: row.finca_reference,
    propertyReferences: row.property_references ?? [],
    properties: Array.isArray(row.properties) ? (row.properties as CatastroFincaRecord["properties"]) : [],
    portals: row.portals ?? [],
    address: (row.address ?? {}) as CatastroFincaRecord["address"],
    ...(row.postal_code ? { postalCode: row.postal_code } : {}),
    postalCodes: row.postal_codes ?? [],
    ...(row.ltp ? { ltp: row.ltp } : {}),
    ...(row.superficie_solar != null ? { superficieSolar: Number(row.superficie_solar) } : {}),
    horizontalDivision: {
      status: row.dh_status,
      confidence: Number(row.dh_confidence),
      reason: row.dh_reason,
      ...(row.dh_reason_code ? { reasonCode: row.dh_reason_code as UnknownReason } : {}),
    },
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function filaDesdeBusqueda(search: CatastroExplorerSearch): SearchRow {
  if (!search.ownerId) throw new Error("Una búsqueda persistida exige ownerId.");
  const criteria = search.criteria;
  return {
    id: search.id,
    user_id: search.ownerId,
    mode: criteria.mode,
    status: search.status,
    provincia: criteria.provincia,
    municipio: criteria.municipio,
    sigla: criteria.mode === "STREET" ? criteria.sigla : null,
    via: criteria.mode === "STREET" ? criteria.via : null,
    numero: criteria.mode === "STREET" ? criteria.numero ?? null : null,
    postal_code:
      criteria.mode === "POSTAL_CODE" ? criteria.postalCode : criteria.postalCode ?? null,
    horizontal_division: criteria.horizontalDivision,
    coverage: search.coverage,
    totals_fincas: search.totals.fincas,
    totals_candidates: search.totals.candidates,
    totals_yes: search.totals.yes,
    totals_unknown: search.totals.unknown,
    totals_not_applicable: search.totals.notApplicable,
    created_at: search.createdAt,
    updated_at: search.updatedAt,
    completed_at: search.completedAt ?? null,
  };
}

function criteriosDesdeFila(row: SearchRow): CatastroExplorerSearchCriteria {
  if (row.mode === "POSTAL_CODE") {
    return {
      mode: "POSTAL_CODE",
      provincia: row.provincia,
      municipio: row.municipio,
      postalCode: row.postal_code ?? "",
      horizontalDivision: row.horizontal_division,
    };
  }
  return {
    mode: "STREET",
    provincia: row.provincia,
    municipio: row.municipio,
    sigla: row.sigla ?? "CL",
    via: row.via ?? "",
    ...(row.numero ? { numero: row.numero } : {}),
    ...(row.postal_code ? { postalCode: row.postal_code } : {}),
    horizontalDivision: row.horizontal_division,
  };
}

export function busquedaDesdeFila(row: SearchRow): CatastroExplorerSearch {
  const coverage = (row.coverage ?? {}) as CatastroExplorerCoverage;
  return {
    id: row.id,
    ownerId: row.user_id,
    criteria: criteriosDesdeFila(row),
    status: row.status,
    coverage,
    totals: {
      fincas: row.totals_fincas,
      candidates: row.totals_candidates,
      yes: row.totals_yes,
      unknown: row.totals_unknown,
      notApplicable: row.totals_not_applicable,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}

export function filaDesdeResultado(result: CatastroExplorerSearchResult): ResultRow {
  return {
    search_id: result.searchId,
    finca_reference: result.fincaReference,
    discovered_at: result.discoveredAt,
    classification_status: result.classificationAtDiscovery.status,
    classification_reason_code: result.classificationAtDiscovery.reasonCode ?? null,
    postal_code_matched: result.postalCodeMatched ?? null,
    portals_at_discovery: result.portalsAtDiscovery ?? [],
  };
}

export function resultadoDesdeFila(row: ResultRow): CatastroExplorerSearchResult {
  return {
    searchId: row.search_id,
    fincaReference: row.finca_reference,
    discoveredAt: row.discovered_at,
    classificationAtDiscovery: {
      status: row.classification_status,
      ...(row.classification_reason_code
        ? { reasonCode: row.classification_reason_code as UnknownReason }
        : {}),
    },
    ...(row.postal_code_matched ? { postalCodeMatched: row.postal_code_matched } : {}),
    ...(row.portals_at_discovery?.length
      ? { portalsAtDiscovery: row.portals_at_discovery }
      : {}),
  };
}

export function filaDesdeRevision(review: CatastroExplorerReview): ReviewRow {
  return {
    user_id: review.userId,
    finca_reference: review.fincaReference,
    status: review.status,
    updated_at: review.updatedAt,
  };
}

export function revisionDesdeFila(row: ReviewRow): CatastroExplorerReview {
  return {
    userId: row.user_id,
    fincaReference: row.finca_reference,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseExplorerStore(client: ExplorerDbClient): ExplorerStore {
  const tabla = <T>(nombre: string) => client.from(nombre) as unknown as ExplorerDbQuery<T>;

  return {
    async getFinca(fincaReference) {
      const row = await ejecutar(
        tabla<FincaRow>("catastro_fincas")
          .select("*")
          .eq("finca_reference", fincaReference)
          .maybeSingle()
      );
      return row ? fincaDesdeFila(row) : null;
    },
    async getFincas(fincaReferences) {
      if (fincaReferences.length === 0) return [];
      const rows = await ejecutar(
        tabla<FincaRow>("catastro_fincas")
          .select("*")
          .in("finca_reference", fincaReferences) as unknown as Promise<ExplorerDbResult<FincaRow[]>>
      );
      return (rows ?? []).map(fincaDesdeFila);
    },
    async putFinca(finca) {
      const resultado = await tabla<FincaRow>("catastro_fincas").upsert(filaDesdeFinca(finca), {
        onConflict: "finca_reference",
      });
      if (resultado.error) fallo(resultado.error);
    },
    async getSearch(searchId, ownerId) {
      const row = await ejecutar(
        tabla<SearchRow>("catastro_explorer_searches")
          .select("*")
          .eq("id", searchId)
          .eq("user_id", ownerId)
          .maybeSingle()
      );
      return row ? busquedaDesdeFila(row) : null;
    },
    async putSearch(search) {
      const resultado = await tabla<SearchRow>("catastro_explorer_searches").upsert(
        filaDesdeBusqueda(search),
        { onConflict: "id" }
      );
      if (resultado.error) fallo(resultado.error);
    },
    async listRecentSearches(ownerId, limit) {
      const pagina = await this.listSearches(ownerId, { limit: Math.max(0, limit), offset: 0 });
      return pagina.items;
    },
    async listSearches(ownerId, query) {
      let consulta = tabla<SearchRow>("catastro_explorer_searches")
        .select("*", { count: "exact" })
        .eq("user_id", ownerId);
      if (query.mode) consulta = consulta.eq("mode", query.mode);
      if (query.status) consulta = consulta.eq("status", query.status);
      const to = query.offset + Math.max(0, query.limit) - 1;
      const resultado = await (consulta
        .order("updated_at", { ascending: false })
        .range(query.offset, Math.max(query.offset, to)) as unknown as Promise<
        ExplorerDbResult<SearchRow[]>
      >);
      if (resultado.error) fallo(resultado.error);
      return {
        items: (resultado.data ?? []).map(busquedaDesdeFila),
        total: resultado.count ?? resultado.data?.length ?? 0,
        limit: query.limit,
        offset: query.offset,
      };
    },
    async deleteSearch(searchId, ownerId) {
      const existente = await this.getSearch(searchId, ownerId);
      if (!existente) return false;
      const resultados = await tabla<ResultRow>("catastro_explorer_search_results")
        .delete()
        .eq("search_id", searchId);
      if (resultados.error) fallo(resultados.error);
      const busqueda = await tabla<SearchRow>("catastro_explorer_searches")
        .delete()
        .eq("id", searchId)
        .eq("user_id", ownerId);
      if (busqueda.error) fallo(busqueda.error);
      return true;
    },
    async getSearchResult(searchId, fincaReference) {
      const row = await ejecutar(
        tabla<ResultRow>("catastro_explorer_search_results")
          .select("*")
          .eq("search_id", searchId)
          .eq("finca_reference", fincaReference)
          .maybeSingle()
      );
      return row ? resultadoDesdeFila(row) : null;
    },
    async putSearchResult(result) {
      const resultado = await tabla<ResultRow>("catastro_explorer_search_results").upsert(
        filaDesdeResultado(result),
        { onConflict: "search_id,finca_reference", ignoreDuplicates: true }
      );
      if (resultado.error) fallo(resultado.error);
    },
    async listResultReferences(searchId) {
      const rows = await ejecutar(
        tabla<Pick<ResultRow, "finca_reference">>("catastro_explorer_search_results")
          .select("finca_reference")
          .eq("search_id", searchId) as unknown as Promise<
          ExplorerDbResult<Array<Pick<ResultRow, "finca_reference">>>
        >
      );
      return (rows ?? []).map((row) => row.finca_reference);
    },
    async listResultsBySearch(searchId) {
      const pagina = await this.listResultsPage(searchId, { limit: 10_000, offset: 0 });
      return pagina.items;
    },
    async listResultsPage(searchId, query) {
      const to = query.offset + Math.max(0, query.limit) - 1;
      const resultado = await (tabla<ResultRow>("catastro_explorer_search_results")
        .select("*", { count: "exact" })
        .eq("search_id", searchId)
        .order("discovered_at", { ascending: true })
        .order("finca_reference", { ascending: true })
        .range(query.offset, Math.max(query.offset, to)) as unknown as Promise<
        ExplorerDbResult<ResultRow[]>
      >);
      if (resultado.error) fallo(resultado.error);
      return {
        items: (resultado.data ?? []).map(resultadoDesdeFila),
        total: resultado.count ?? resultado.data?.length ?? 0,
        limit: query.limit,
        offset: query.offset,
      };
    },
    async listResultsByFinca(fincaReference) {
      const rows = await ejecutar(
        tabla<ResultRow>("catastro_explorer_search_results")
          .select("*")
          .eq("finca_reference", fincaReference) as unknown as Promise<
          ExplorerDbResult<ResultRow[]>
        >
      );
      return (rows ?? []).map(resultadoDesdeFila);
    },
    async getReview(userId, fincaReference) {
      const row = await ejecutar(
        tabla<ReviewRow>("catastro_explorer_reviews")
          .select("*")
          .eq("user_id", userId)
          .eq("finca_reference", fincaReference)
          .maybeSingle()
      );
      return row ? revisionDesdeFila(row) : null;
    },
    async putReview(review) {
      const resultado = await tabla<ReviewRow>("catastro_explorer_reviews").upsert(
        filaDesdeRevision(review),
        { onConflict: "user_id,finca_reference" }
      );
      if (resultado.error) fallo(resultado.error);
    },
    async listReviews(userId, fincaReferences) {
      if (fincaReferences.length === 0) return [];
      const rows = await ejecutar(
        tabla<ReviewRow>("catastro_explorer_reviews")
          .select("*")
          .eq("user_id", userId)
          .in("finca_reference", fincaReferences) as unknown as Promise<
          ExplorerDbResult<ReviewRow[]>
        >
      );
      return (rows ?? []).map(revisionDesdeFila);
    },
  };
}
