/**
 * Modelo de producto de Catastro Explorer.
 * La finca canónica es FincaDescubierta: no hay una segunda representación.
 */
import type { EstadoDhFinca } from "../applicability";
import type { FiltroDivisionHorizontal } from "../candidates";
import type { FincaDescubierta } from "../finca";
import type { EstadoRevision } from "../revision-comercial";
import type { UnknownReason } from "../unknown-reason";

/** Entidad canónica. Alias de `FincaDescubierta`. */
export type CatastroFinca = FincaDescubierta;

export type CatastroFincaRecord = CatastroFinca & {
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CatastroExplorerSearchMode = "STREET" | "POSTAL_CODE";

export type CatastroExplorerSearchCriteriaStreet = {
  mode: "STREET";
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero?: string;
  postalCode?: string;
  horizontalDivision: FiltroDivisionHorizontal;
};

export type CatastroExplorerSearchCriteriaPostal = {
  mode: "POSTAL_CODE";
  provincia: string;
  municipio: string;
  postalCode: string;
  horizontalDivision: FiltroDivisionHorizontal;
};

export type CatastroExplorerSearchCriteria =
  | CatastroExplorerSearchCriteriaStreet
  | CatastroExplorerSearchCriteriaPostal;

export type CatastroExplorerSearchStatus =
  | "PREPARED"
  | "RUNNING"
  | "PAUSED"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export type CatastroExplorerCoverage = {
  complete: boolean;
  completeCandidates: boolean;
  possibleCut: boolean;
  portalsFound?: number;
  portalsProcessed?: number;
  streetsFound?: number;
  streetsProcessed?: number;
  streetsWithErrors?: number;
};

export type CatastroExplorerTotals = {
  fincas: number;
  candidates: number;
  yes: number;
  unknown: number;
  notApplicable: number;
};

export type CatastroExplorerSearch = {
  id: string;
  /** Identidad del host (usuario). Explorer no conoce el CRM. */
  ownerId?: string;
  criteria: CatastroExplorerSearchCriteria;
  status: CatastroExplorerSearchStatus;
  coverage: CatastroExplorerCoverage;
  totals: CatastroExplorerTotals;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type CatastroExplorerSearchResult = {
  searchId: string;
  fincaReference: string;
  discoveredAt: string;
  classificationAtDiscovery: {
    status: EstadoDhFinca;
    reasonCode?: UnknownReason;
  };
  postalCodeMatched?: string;
  portalsAtDiscovery?: string[];
};

/** Estado comercial por usuario + finca. No es una propiedad de CatastroFinca. */
export type CatastroExplorerReview = {
  userId: string;
  fincaReference: string;
  status: EstadoRevision;
  updatedAt: string;
};

export type ExplorerResultsPage = {
  items: CatastroExplorerSearchResult[];
  total: number;
  limit: number;
  offset: number;
};

export const EXPLORER_RECENT_LIMIT = 20;
export const EXPLORER_SEARCHES_PAGE_SIZE = 20;
export const EXPLORER_SEARCHES_PAGE_MAX = 50;
export const EXPLORER_RESULTS_PAGE_SIZE = 50;
export const EXPLORER_RESULTS_PAGE_MAX = 100;

export type ExplorerSearchesQuery = {
  limit: number;
  offset: number;
  mode?: CatastroExplorerSearchMode;
  status?: CatastroExplorerSearchStatus;
};

export type ExplorerSearchesPage = {
  items: CatastroExplorerSearch[];
  total: number;
  limit: number;
  offset: number;
};

export type { EstadoDhFinca, EstadoRevision, FiltroDivisionHorizontal, UnknownReason };
