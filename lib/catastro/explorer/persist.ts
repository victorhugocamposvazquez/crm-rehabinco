/**
 * Persistencia de dominio: habla solo con ExplorerStore.
 * No conoce Supabase, SQL ni tablas del CRM.
 */
import {
  actualizarBusqueda,
  crearBusqueda,
  estadoDesdeZona,
  fusionarBusquedaPersistida,
  totalesDesdeFincas,
} from "./model";
import type { ExplorerStore } from "./ports";
import { registrarDescubrimiento } from "./store";
import type {
  CatastroExplorerCoverage,
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchCriteria,
  CatastroExplorerSearchStatus,
  CatastroFinca,
  EstadoRevision,
} from "./types";

export async function persistirDescubrimientos(
  store: ExplorerStore,
  search: CatastroExplorerSearch,
  fincas: CatastroFinca[],
  now: string
): Promise<void> {
  const existentes = new Set(await store.listResultReferences(search.id));
  for (const finca of fincas) {
    if (existentes.has(finca.fincaReference)) continue;
    await registrarDescubrimiento(store, search, finca, now);
    existentes.add(finca.fincaReference);
  }
}

export async function persistirBusqueda(
  store: ExplorerStore,
  propuesta: CatastroExplorerSearch,
  fincas: CatastroFinca[],
  now: string
): Promise<CatastroExplorerSearch> {
  if (!propuesta.ownerId) {
    throw new Error("Una búsqueda persistida exige ownerId.");
  }
  const previa = await store.getSearch(propuesta.id, propuesta.ownerId);
  const search = fusionarBusquedaPersistida(previa, {
    ...propuesta,
    createdAt: previa?.createdAt ?? propuesta.createdAt,
    updatedAt: now,
  });
  await store.putSearch(search);
  await persistirDescubrimientos(store, search, fincas, now);
  return search;
}

export function propuestaBusqueda(input: {
  id: string;
  ownerId: string;
  criteria: CatastroExplorerSearchCriteria;
  status: CatastroExplorerSearchStatus;
  coverage: CatastroExplorerCoverage;
  fincas: CatastroFinca[];
  now: string;
}): CatastroExplorerSearch {
  return actualizarBusqueda(
    crearBusqueda({
      id: input.id,
      ownerId: input.ownerId,
      criteria: input.criteria,
      now: input.now,
      status: input.status,
    }),
    {
      status: input.status,
      coverage: input.coverage,
      totals: totalesDesdeFincas(input.fincas),
      now: input.now,
    }
  );
}

export function estadoZonaHaciaExplorer(
  status: Parameters<typeof estadoDesdeZona>[0]
): CatastroExplorerSearchStatus {
  return estadoDesdeZona(status);
}

/** Borra búsqueda y resultados. No toca fincas ni reviews. */
export async function eliminarBusqueda(
  store: ExplorerStore,
  searchId: string,
  ownerId: string
): Promise<"deleted" | "not_found"> {
  const propia = await store.getSearch(searchId, ownerId);
  if (!propia) return "not_found";
  const borrada = await store.deleteSearch(searchId, ownerId);
  return borrada ? "deleted" : "not_found";
}

export async function persistirRevision(
  store: ExplorerStore,
  input: {
    userId: string;
    fincaReference: string;
    status: EstadoRevision;
    now: string;
  }
): Promise<CatastroExplorerReview> {
  const review: CatastroExplorerReview = {
    userId: input.userId,
    fincaReference: input.fincaReference,
    status: input.status,
    updatedAt: input.now,
  };
  await store.putReview(review);
  return review;
}
