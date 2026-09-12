import type { ZoneStatus } from "../zone-session";
import { fusionarFincas } from "../candidates";
import { getFincaReference } from "../references";
import type { EstadoRevision } from "../revision-comercial";
import {
  EXPLORER_RESULTS_PAGE_MAX,
  EXPLORER_RESULTS_PAGE_SIZE,
  EXPLORER_SEARCHES_PAGE_MAX,
  EXPLORER_SEARCHES_PAGE_SIZE,
  type CatastroExplorerCoverage,
  type CatastroExplorerSearch,
  type CatastroExplorerSearchCriteria,
  type CatastroExplorerSearchMode,
  type CatastroExplorerSearchResult,
  type CatastroExplorerSearchStatus,
  type CatastroExplorerTotals,
  type CatastroFinca,
  type CatastroFincaRecord,
  type ExplorerSearchesQuery,
} from "./types";

export const TOTALES_VACIOS: CatastroExplorerTotals = {
  fincas: 0,
  candidates: 0,
  yes: 0,
  unknown: 0,
  notApplicable: 0,
};

export const COBERTURA_VACIA: CatastroExplorerCoverage = {
  complete: false,
  completeCandidates: false,
  possibleCut: false,
};

export function identidadFinca(rc: string): string | null {
  return getFincaReference(rc);
}

export function validarCriteriosExplorer(
  criteria: CatastroExplorerSearchCriteria
): { ok: true } | { ok: false; error: string } {
  if (!criteria.provincia.trim() || !criteria.municipio.trim()) {
    return { ok: false, error: "Faltan provincia y municipio." };
  }
  if (criteria.mode === "STREET") {
    if (!criteria.sigla.trim() || !criteria.via.trim()) {
      return { ok: false, error: "La búsqueda por calle exige sigla y vía oficiales." };
    }
    return { ok: true };
  }
  if (!/^\d{5}$/.test(criteria.postalCode.trim())) {
    return { ok: false, error: "La búsqueda por código postal exige un CP de 5 dígitos." };
  }
  return { ok: true };
}

/** El CP no es un criterio de Catastro: no hay sigla/vía que enviar al WCF. */
export function criteriosHaciaCatastro(criteria: CatastroExplorerSearchCriteria): {
  enviaCodigoPostalACatastro: false;
  recorreCallejero: boolean;
} {
  return {
    enviaCodigoPostalACatastro: false,
    recorreCallejero: criteria.mode === "POSTAL_CODE",
  };
}

export function crearBusqueda(input: {
  id: string;
  criteria: CatastroExplorerSearchCriteria;
  now: string;
  ownerId?: string;
  status?: CatastroExplorerSearchStatus;
}): CatastroExplorerSearch {
  const validado = validarCriteriosExplorer(input.criteria);
  if (!validado.ok) throw new Error(validado.error);
  return {
    id: input.id,
    ownerId: input.ownerId,
    criteria: input.criteria,
    status: input.status ?? "PREPARED",
    coverage: { ...COBERTURA_VACIA },
    totals: { ...TOTALES_VACIOS },
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function totalesDesdeFincas(fincas: CatastroFinca[]): CatastroExplorerTotals {
  const totals = { ...TOTALES_VACIOS, fincas: fincas.length };
  for (const finca of fincas) {
    const status = finca.horizontalDivision.status;
    if (status === "NO") totals.candidates += 1;
    else if (status === "YES") totals.yes += 1;
    else if (status === "NOT_APPLICABLE") totals.notApplicable += 1;
    else totals.unknown += 1;
  }
  return totals;
}

export function estadoDesdeZona(status: ZoneStatus): CatastroExplorerSearchStatus {
  if (status === "prepared") return "PREPARED";
  if (status === "running") return "RUNNING";
  if (status === "paused" || status === "upstream_paused") return "PAUSED";
  if (status === "cancelled") return "CANCELLED";
  if (status === "done") return "COMPLETED";
  return "FAILED";
}

export function actualizarBusqueda(
  search: CatastroExplorerSearch,
  patch: Partial<
    Pick<CatastroExplorerSearch, "status" | "coverage" | "totals" | "completedAt">
  > & { now: string }
): CatastroExplorerSearch {
  const completed =
    patch.status === "COMPLETED" || patch.status === "CANCELLED" || patch.status === "FAILED";
  return {
    ...search,
    status: patch.status ?? search.status,
    coverage: patch.coverage ?? search.coverage,
    totals: patch.totals ?? search.totals,
    updatedAt: patch.now,
    completedAt: completed ? (patch.completedAt ?? patch.now) : search.completedAt,
  };
}

export function recordDesdeFinca(
  finca: CatastroFinca,
  now: string,
  previa?: CatastroFincaRecord
): CatastroFincaRecord {
  const fusion = previa ? fusionarFincas(previa, finca) : finca;
  return {
    ...fusion,
    firstSeenAt: previa?.firstSeenAt ?? now,
    lastSeenAt: now,
  };
}

export function resultadoDesdeFinca(
  searchId: string,
  finca: CatastroFinca,
  now: string
): CatastroExplorerSearchResult {
  return {
    searchId,
    fincaReference: finca.fincaReference,
    discoveredAt: now,
    classificationAtDiscovery: {
      status: finca.horizontalDivision.status,
      ...(finca.horizontalDivision.reasonCode
        ? { reasonCode: finca.horizontalDivision.reasonCode }
        : {}),
    },
    postalCodeMatched: finca.postalCode,
    portalsAtDiscovery: [...finca.portals],
  };
}

/**
 * Una finca global. REVIEW no entra aquí: es estado comercial aparte.
 */
export function revisionNoCambiaClasificacion(
  status: CatastroFinca["horizontalDivision"]["status"],
  _revision: EstadoRevision
): CatastroFinca["horizontalDivision"]["status"] {
  return status;
}

export function ordenarBusquedasRecientes(
  busquedas: CatastroExplorerSearch[]
): CatastroExplorerSearch[] {
  return [...busquedas].sort((a, b) => {
    const porFecha = b.updatedAt.localeCompare(a.updatedAt);
    if (porFecha !== 0) return porFecha;
    return b.id.localeCompare(a.id);
  });
}

export function tituloBusquedaReciente(search: CatastroExplorerSearch): string {
  const municipio = search.criteria.municipio.trim();
  if (search.criteria.mode === "POSTAL_CODE") {
    return `${municipio} · CP ${search.criteria.postalCode}`;
  }
  const via = [search.criteria.sigla, search.criteria.via].filter(Boolean).join(" ").trim();
  const numero = search.criteria.numero?.trim();
  return numero ? `${municipio} · ${via} ${numero}` : `${municipio} · ${via}`;
}

export function resumenBusquedaReciente(search: CatastroExplorerSearch): {
  titulo: string;
  fincas: number;
  candidatas: number;
  status: CatastroExplorerSearchStatus;
  updatedAt: string;
} {
  return {
    titulo: tituloBusquedaReciente(search),
    fincas: search.totals.fincas,
    candidatas: search.totals.candidates,
    status: search.status,
    updatedAt: search.updatedAt,
  };
}

/** Conserva createdAt y ownerId; actualiza estado, cobertura y totales. */
export function fusionarBusquedaPersistida(
  previa: CatastroExplorerSearch | null,
  propuesta: CatastroExplorerSearch
): CatastroExplorerSearch {
  if (!previa) return propuesta;
  return {
    ...previa,
    criteria: propuesta.criteria,
    status: propuesta.status,
    coverage: propuesta.coverage,
    totals: propuesta.totals,
    updatedAt: propuesta.updatedAt,
    completedAt: propuesta.completedAt ?? previa.completedAt,
  };
}

export function acotarPaginaResultados(limit: number | undefined, offset: number | undefined): {
  limit: number;
  offset: number;
} {
  const bruto = limit == null || !Number.isFinite(limit) ? EXPLORER_RESULTS_PAGE_SIZE : Math.floor(limit);
  return {
    limit: Math.min(EXPLORER_RESULTS_PAGE_MAX, Math.max(1, bruto)),
    offset: Math.max(0, Math.floor(offset ?? 0)),
  };
}

export function acotarPaginaHistorico(limit: number | undefined, offset: number | undefined): {
  limit: number;
  offset: number;
} {
  const bruto = limit == null || !Number.isFinite(limit) ? EXPLORER_SEARCHES_PAGE_SIZE : Math.floor(limit);
  return {
    limit: Math.min(EXPLORER_SEARCHES_PAGE_MAX, Math.max(1, bruto)),
    offset: Math.max(0, Math.floor(offset ?? 0)),
  };
}

const MODOS_HISTORICO = new Set<CatastroExplorerSearchMode>(["STREET", "POSTAL_CODE"]);
const ESTADOS_HISTORICO = new Set<CatastroExplorerSearchStatus>([
  "PREPARED",
  "RUNNING",
  "PAUSED",
  "CANCELLED",
  "COMPLETED",
  "FAILED",
]);

/** Filtros de listado. No mezclar con cursor de Catastro ni con SearchResults. */
export function consultaHistoricoBusquedas(input: {
  limit?: number;
  offset?: number;
  mode?: string | null;
  status?: string | null;
}): ExplorerSearchesQuery {
  const pagina = acotarPaginaHistorico(input.limit, input.offset);
  const mode = input.mode && MODOS_HISTORICO.has(input.mode as CatastroExplorerSearchMode)
    ? (input.mode as CatastroExplorerSearchMode)
    : undefined;
  const status =
    input.status && ESTADOS_HISTORICO.has(input.status as CatastroExplorerSearchStatus)
      ? (input.status as CatastroExplorerSearchStatus)
      : undefined;
  return { ...pagina, ...(mode ? { mode } : {}), ...(status ? { status } : {}) };
}
