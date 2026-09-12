/**
 * Puertos del host. Catastro Explorer no importa CRM, Leads, Propiedades ni Visitas.
 * El host implementa auth en `app/api/catastro/*` y persistencia vía `ExplorerStore`.
 * El dominio no conoce `supabase.from` ni SQL.
 */
import type {
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchResult,
  CatastroFincaRecord,
  ExplorerResultsPage,
  ExplorerSearchesPage,
  ExplorerSearchesQuery,
} from "./types";

export type ExplorerClock = {
  nowIso: () => string;
};

export const clockSistema: ExplorerClock = {
  nowIso: () => new Date().toISOString(),
};

export type ExplorerIdentity = {
  userId: string;
};

export type ExplorerAuth = {
  currentUser(): Promise<ExplorerIdentity | null>;
};

export type ExplorerResultsQuery = {
  limit: number;
  offset: number;
};

/**
 * Persistencia portable. Un host puede sustituir Supabase por Postgres, REST o memoria
 * sin tocar el motor catastral.
 */
export type ExplorerStore = {
  getFinca(fincaReference: string): Promise<CatastroFincaRecord | null>;
  getFincas(fincaReferences: string[]): Promise<CatastroFincaRecord[]>;
  putFinca(finca: CatastroFincaRecord): Promise<void>;
  getSearch(searchId: string, ownerId: string): Promise<CatastroExplorerSearch | null>;
  putSearch(search: CatastroExplorerSearch): Promise<void>;
  listRecentSearches(ownerId: string, limit: number): Promise<CatastroExplorerSearch[]>;
  listSearches(ownerId: string, query: ExplorerSearchesQuery): Promise<ExplorerSearchesPage>;
  /** Solo el propietario. No borra CatastroFinca ni Review. */
  deleteSearch(searchId: string, ownerId: string): Promise<boolean>;
  getSearchResult(
    searchId: string,
    fincaReference: string
  ): Promise<CatastroExplorerSearchResult | null>;
  putSearchResult(result: CatastroExplorerSearchResult): Promise<void>;
  listResultReferences(searchId: string): Promise<string[]>;
  listResultsBySearch(searchId: string): Promise<CatastroExplorerSearchResult[]>;
  listResultsPage(searchId: string, query: ExplorerResultsQuery): Promise<ExplorerResultsPage>;
  listResultsByFinca(fincaReference: string): Promise<CatastroExplorerSearchResult[]>;
  getReview(userId: string, fincaReference: string): Promise<CatastroExplorerReview | null>;
  putReview(review: CatastroExplorerReview): Promise<void>;
  listReviews(userId: string, fincaReferences: string[]): Promise<CatastroExplorerReview[]>;
};
