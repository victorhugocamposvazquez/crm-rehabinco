/**
 * Store en memoria. Sirve de contrato y de LocalExplorerStore.
 * Un host real inyecta otro adaptador (Supabase, Postgres, REST).
 */
import { ordenarBusquedasRecientes, recordDesdeFinca, resultadoDesdeFinca } from "./model";
import type { ExplorerStore } from "./ports";
import type {
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchResult,
  CatastroFinca,
  CatastroFincaRecord,
} from "./types";

export function crearStoreMemoriaExplorer(): ExplorerStore {
  const fincas = new Map<string, CatastroFincaRecord>();
  const searches = new Map<string, CatastroExplorerSearch>();
  const results = new Map<string, CatastroExplorerSearchResult>();
  const reviews = new Map<string, CatastroExplorerReview>();

  const claveResultado = (searchId: string, fincaReference: string) => `${searchId}|${fincaReference}`;
  const claveRevision = (userId: string, fincaReference: string) => `${userId}|${fincaReference}`;

  return {
    async getFinca(fincaReference) {
      return fincas.get(fincaReference) ?? null;
    },
    async getFincas(fincaReferences) {
      return fincaReferences
        .map((referencia) => fincas.get(referencia))
        .filter((item): item is CatastroFincaRecord => item != null);
    },
    async putFinca(finca) {
      fincas.set(finca.fincaReference, finca);
    },
    async getSearch(searchId, ownerId) {
      const search = searches.get(searchId);
      if (!search || search.ownerId !== ownerId) return null;
      return search;
    },
    async putSearch(search) {
      searches.set(search.id, search);
    },
    async listRecentSearches(ownerId, limit) {
      const pagina = await this.listSearches(ownerId, { limit: Math.max(0, limit), offset: 0 });
      return pagina.items;
    },
    async listSearches(ownerId, query) {
      let propias = [...searches.values()].filter((item) => item.ownerId === ownerId);
      if (query.mode) propias = propias.filter((item) => item.criteria.mode === query.mode);
      if (query.status) propias = propias.filter((item) => item.status === query.status);
      const ordenadas = ordenarBusquedasRecientes(propias);
      const limit = Math.max(0, query.limit);
      const offset = Math.max(0, query.offset);
      return {
        items: ordenadas.slice(offset, offset + limit),
        total: ordenadas.length,
        limit,
        offset,
      };
    },
    async deleteSearch(searchId, ownerId) {
      const search = searches.get(searchId);
      if (!search || search.ownerId !== ownerId) return false;
      for (const [clave, result] of [...results.entries()]) {
        if (result.searchId === searchId) results.delete(clave);
      }
      searches.delete(searchId);
      return true;
    },
    async getSearchResult(searchId, fincaReference) {
      return results.get(claveResultado(searchId, fincaReference)) ?? null;
    },
    async putSearchResult(result) {
      const clave = claveResultado(result.searchId, result.fincaReference);
      if (!results.has(clave)) results.set(clave, result);
    },
    async listResultReferences(searchId) {
      return [...results.values()]
        .filter((item) => item.searchId === searchId)
        .map((item) => item.fincaReference);
    },
    async listResultsBySearch(searchId) {
      return [...results.values()].filter((item) => item.searchId === searchId);
    },
    async listResultsPage(searchId, query) {
      const todos = [...results.values()]
        .filter((item) => item.searchId === searchId)
        .sort((a, b) => {
          const porFecha = a.discoveredAt.localeCompare(b.discoveredAt);
          if (porFecha !== 0) return porFecha;
          return a.fincaReference.localeCompare(b.fincaReference);
        });
      const limit = Math.max(0, query.limit);
      const offset = Math.max(0, query.offset);
      return {
        items: todos.slice(offset, offset + limit),
        total: todos.length,
        limit,
        offset,
      };
    },
    async listResultsByFinca(fincaReference) {
      return [...results.values()].filter((item) => item.fincaReference === fincaReference);
    },
    async getReview(userId, fincaReference) {
      return reviews.get(claveRevision(userId, fincaReference)) ?? null;
    },
    async putReview(review) {
      reviews.set(claveRevision(review.userId, review.fincaReference), review);
    },
    async listReviews(userId, fincaReferences) {
      return fincaReferences
        .map((referencia) => reviews.get(claveRevision(userId, referencia)))
        .filter((item): item is CatastroExplorerReview => item != null);
    },
  };
}

/** Deduplica la finca global y añade (o conserva) el SearchResult. */
export async function registrarDescubrimiento(
  store: ExplorerStore,
  search: CatastroExplorerSearch,
  finca: CatastroFinca,
  now: string
): Promise<{ finca: CatastroFincaRecord; result: CatastroExplorerSearchResult }> {
  const previa = await store.getFinca(finca.fincaReference);
  const record = recordDesdeFinca(finca, now, previa ?? undefined);
  await store.putFinca(record);
  const existente = await store.getSearchResult(search.id, finca.fincaReference);
  const result = existente ?? resultadoDesdeFinca(search.id, finca, now);
  if (!existente) await store.putSearchResult(result);
  return { finca: record, result };
}
