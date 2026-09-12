/**
 * Adaptador de presentación para búsquedas persistidas.
 * Habla HTTP; no conoce Supabase ni SQL ni llama a Catastro.
 */
import {
  CSV_MIME_TYPE,
  advertenciaExportacion,
  csvDesdeFincas,
  nombreArchivoExportacion,
  type CoberturaExportacion,
  type CriteriosNombreArchivo,
  type ExportacionPreparada,
  type SeleccionFincas,
} from "../selection-export";
import { FILTROS_DIVISION, type FincaBusquedaUi } from "../search-ui";
import { REVISION_VACIA, type EstadoRevision, type RevisionFincas } from "../revision-comercial";
import { resumenBusquedaReciente } from "./model";
import type { CatastroPropertyLink } from "./property-port";
import {
  EXPLORER_RECENT_LIMIT,
  EXPLORER_RESULTS_PAGE_SIZE,
  EXPLORER_SEARCHES_PAGE_SIZE,
  type CatastroExplorerCoverage,
  type CatastroExplorerReview,
  type CatastroExplorerSearch,
  type CatastroExplorerSearchCriteria,
  type CatastroExplorerSearchResult,
  type CatastroExplorerSearchStatus,
  type CatastroFinca,
} from "./types";

export const RUTA_EXPLORER = "/catastro";
export const RUTA_NUEVA_BUSQUEDA = "/buscar";
export const RUTA_HISTORICO = "/catastro/searches";

export function rutaBusquedaHistorica(id: string): string {
  return `${RUTA_EXPLORER}/searches/${id}`;
}

export function rutaFincaPersistida(fincaReference: string): string {
  return `${RUTA_EXPLORER}/finca/${fincaReference}`;
}

export const TEXTO_CARGANDO_BUSQUEDAS = "Cargando búsquedas...";
export const TEXTO_CARGANDO_BUSQUEDA = "Cargando búsqueda...";
export const TEXTO_CARGANDO_FINCA = "Cargando finca...";
export const ERROR_RECIENTES = "No se han podido cargar las búsquedas recientes.";
export const ERROR_HISTORICO = "No se han podido cargar las búsquedas.";
export const ERROR_BUSQUEDA_404 = "Esta búsqueda no existe o no tienes acceso.";
export const ERROR_FINCA_404 = "No se ha encontrado la finca.";
export const ERROR_ELIMINAR = "No se ha podido eliminar la búsqueda.";
export const TEXTO_REINTENTAR = "Reintentar";
export const TEXTO_VER_TODO = "Ver todo";
export const TEXTO_ELIMINAR_BUSQUEDA = "Eliminar búsqueda";
export const TEXTO_CONFIRMAR_ELIMINAR_TITULO = "¿Eliminar esta búsqueda?";
export const TEXTO_CONFIRMAR_ELIMINAR =
  "Se eliminarán el historial y sus resultados asociados. Las fincas descubiertas no se eliminarán de Catastro Explorer.";

export const FILTROS_LISTADO_HISTORICO = [
  { value: "ALL", label: "Todas" },
  { value: "STREET", label: "Por calle" },
  { value: "POSTAL_CODE", label: "Por código postal" },
] as const;

export type FiltroListadoHistorico = (typeof FILTROS_LISTADO_HISTORICO)[number]["value"];

export const CLASES_TARJETA_BUSQUEDA =
  "flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5";

export type CoberturaRecienteUi = Pick<CatastroExplorerCoverage, "complete" | "possibleCut">;

export type ResumenBusquedaUi = ReturnType<typeof resumenBusquedaReciente> & {
  id: string;
  mode: CatastroExplorerSearch["criteria"]["mode"];
  coverage?: CoberturaRecienteUi;
};

export type BusquedaRecuperadaUi = {
  search: CatastroExplorerSearch;
  summary: ResumenBusquedaUi;
  results: {
    items: CatastroExplorerSearchResult[];
    fincas: FincaBusquedaUi[];
    total: number;
    limit: number;
    offset: number;
  };
  reviews: CatastroExplorerReview[];
  links?: CatastroPropertyLink[];
};

export type FincaPersistidaUi = {
  finca: FincaBusquedaUi;
  review: CatastroExplorerReview | null;
  lastSeenAt?: string | null;
  links?: CatastroPropertyLink[];
};

export type FiltroHistorico = "ALL" | "CANDIDATES" | "UNKNOWN" | "NOT_APPLICABLE" | "REVIEW";

export const FILTROS_HISTORICOS = [
  { value: "ALL", label: "Todos" },
  { value: "CANDIDATES", label: "Candidatos" },
  { value: "UNKNOWN", label: "NO determinados" },
  { value: "NOT_APPLICABLE", label: "No aplicables" },
  { value: "REVIEW", label: "Para revisar" },
] as const;

export const ESTADO_BUSQUEDA_UI: Record<CatastroExplorerSearchStatus, string> = {
  PREPARED: "PREPARED",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
};

function errorHttp(status: number, fallback: string, notFound?: string): Error {
  if (status === 401) return new Error("Tu sesión ha caducado. Vuelve a iniciar sesión.");
  if (status === 404) return new Error(notFound ?? fallback);
  return new Error(fallback);
}

export function esUrlHistorica(url: string): boolean {
  return (
    url.includes("/api/catastro/searches") ||
    url.includes("/api/catastro/fincas") ||
    url.includes("/api/catastro/reviews") ||
    url.includes("/api/catastro/property-links")
  );
}

export function llamaACatastro(url: string): boolean {
  return (
    /\/api\/catastro\/(search|zone|streets|provinces|municipalities)(\?|\/|$)/.test(url) ||
    url.includes("ovcservweb") ||
    url.includes("catastro.meh.es")
  );
}

export function resumenDesdeBusqueda(search: CatastroExplorerSearch): ResumenBusquedaUi {
  return {
    id: search.id,
    mode: search.criteria.mode,
    coverage: {
      complete: search.coverage.complete,
      possibleCut: search.coverage.possibleCut,
    },
    ...resumenBusquedaReciente(search),
  };
}

export function fincaUiDesdeRecord(finca: CatastroFinca): FincaBusquedaUi {
  return {
    fincaReference: finca.fincaReference,
    portals: finca.portals,
    address: finca.address,
    postalCode: finca.postalCode,
    postalCodes: finca.postalCodes,
    superficieSolar: finca.superficieSolar,
    horizontalDivision: finca.horizontalDivision,
    properties: finca.properties,
  };
}

export function etiquetaTipoBusqueda(mode: CatastroExplorerSearch["criteria"]["mode"]): string {
  return mode === "POSTAL_CODE" ? "POR CÓDIGO POSTAL" : "POR CALLE";
}

export function formatoNumeroEs(valor: number): string {
  return valor.toLocaleString("es-ES");
}

export function fechaBusquedaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-ES");
}

export function textosCoberturaHistorica(coverage?: CoberturaRecienteUi): {
  estado: "Búsqueda completa" | "Búsqueda incompleta";
  corte: string | null;
} {
  return {
    estado: coverage?.complete ? "Búsqueda completa" : "Búsqueda incompleta",
    corte: coverage?.possibleCut
      ? "Cobertura potencialmente incompleta por limitación de Catastro."
      : null,
  };
}

export type CriterioVisible = { label: string; value: string };

export function criteriosVisibles(criteria: CatastroExplorerSearchCriteria): CriterioVisible[] {
  const filtro =
    FILTROS_DIVISION.find((item) => item.value === criteria.horizontalDivision)?.label ??
    criteria.horizontalDivision;
  const items: CriterioVisible[] = [
    { label: "Provincia", value: criteria.provincia },
    { label: "Municipio", value: criteria.municipio },
  ];
  if (criteria.mode === "STREET") {
    items.push({ label: "Calle", value: [criteria.sigla, criteria.via].filter(Boolean).join(" ") });
    if (criteria.numero?.trim()) items.push({ label: "Número", value: criteria.numero.trim() });
    if (criteria.postalCode?.trim()) items.push({ label: "CP", value: criteria.postalCode.trim() });
  } else {
    items.push({ label: "CP", value: criteria.postalCode });
  }
  items.push({ label: "Filtro de división horizontal", value: filtro });
  return items.filter((item) => item.value.trim());
}

export function filtrarFincasHistoricas(
  fincas: FincaBusquedaUi[],
  filtro: FiltroHistorico,
  revision: RevisionFincas
): FincaBusquedaUi[] {
  if (filtro === "CANDIDATES") {
    return fincas.filter((finca) => finca.horizontalDivision?.status === "NO");
  }
  if (filtro === "UNKNOWN") {
    return fincas.filter((finca) => finca.horizontalDivision?.status === "UNKNOWN");
  }
  if (filtro === "NOT_APPLICABLE") {
    return fincas.filter((finca) => finca.horizontalDivision?.status === "NOT_APPLICABLE");
  }
  if (filtro === "REVIEW") {
    return fincas.filter((finca) =>
      revision.fincas.some((item) => item.fincaReference === finca.fincaReference)
    );
  }
  return fincas;
}

/** Solo REVIEW del usuario indicado. Nunca mezcla revisiones de otro. */
export function revisionDesdePersistida(
  claveBusqueda: string,
  fincas: FincaBusquedaUi[],
  reviews: CatastroExplorerReview[],
  userId?: string
): RevisionFincas {
  const propias = new Set(
    reviews
      .filter((item) => {
        if (item.status !== "REVIEW") return false;
        if (!userId) return true;
        return item.userId === userId;
      })
      .map((item) => item.fincaReference)
  );
  return {
    claveBusqueda,
    fincas: fincas.filter((finca) => propias.has(finca.fincaReference)),
  };
}

export function claveHistorica(searchId: string): string {
  return `historica:${searchId}`;
}

export function criteriosNombreHistorica(
  criteria: CatastroExplorerSearchCriteria
): CriteriosNombreArchivo {
  if (criteria.mode === "STREET") {
    return {
      municipio: criteria.municipio,
      via: criteria.via,
      numero: criteria.numero ?? "",
      postalCode: criteria.postalCode,
      horizontalDivision: criteria.horizontalDivision,
    };
  }
  return {
    municipio: criteria.municipio,
    via: "",
    numero: "",
    postalCode: criteria.postalCode,
    horizontalDivision: criteria.horizontalDivision,
  };
}

export function coberturaHistorica(coverage: CoberturaRecienteUi): CoberturaExportacion {
  return {
    completeCandidates: coverage.complete,
    possibleCut: coverage.possibleCut,
  };
}

/** CSV de la página o de la selección temporal. No consulta Catastro. */
export function prepararExportacionHistorica(input: {
  fincas: FincaBusquedaUi[];
  seleccion: SeleccionFincas;
  revision?: RevisionFincas;
  criterios: CriteriosNombreArchivo;
  cobertura: CoberturaExportacion;
  fecha?: Date;
}): ExportacionPreparada {
  const fincas = input.seleccion.fincas.length > 0 ? input.seleccion.fincas : input.fincas;
  if (fincas.length === 0) {
    return { ok: false, motivo: "No hay fincas para exportar." };
  }
  const revision = input.revision ?? REVISION_VACIA;
  return {
    ok: true,
    nombreArchivo: nombreArchivoExportacion(input.criterios, input.fecha ?? new Date()),
    contenido: csvDesdeFincas(fincas, revision),
    mimeType: CSV_MIME_TYPE,
    totalFincas: fincas.length,
    advertencia: advertenciaExportacion(input.cobertura),
  };
}

export type HistoricoBusquedasUi = {
  searches: ResumenBusquedaUi[];
  total: number;
  limit: number;
  offset: number;
};

export function paramsHistoricoBusquedas(query: {
  limit?: number;
  offset?: number;
  mode?: FiltroListadoHistorico;
}): string {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? EXPLORER_SEARCHES_PAGE_SIZE));
  params.set("offset", String(query.offset ?? 0));
  if (query.mode && query.mode !== "ALL") params.set("mode", query.mode);
  return params.toString();
}

export async function fetchHistoricoBusquedas(
  query: { limit?: number; offset?: number; mode?: FiltroListadoHistorico } = {},
  signal?: AbortSignal
): Promise<HistoricoBusquedasUi> {
  const respuesta = await fetch(`/api/catastro/searches?${paramsHistoricoBusquedas(query)}`, {
    signal,
  });
  if (!respuesta.ok) throw errorHttp(respuesta.status, ERROR_HISTORICO);
  return (await respuesta.json()) as HistoricoBusquedasUi;
}

export async function eliminarBusquedaUi(id: string): Promise<void> {
  const respuesta = await fetch(`/api/catastro/searches/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (respuesta.status === 404) throw errorHttp(404, ERROR_ELIMINAR, ERROR_BUSQUEDA_404);
  if (!respuesta.ok) throw errorHttp(respuesta.status, ERROR_ELIMINAR);
}

export async function fetchBusquedasRecientes(
  limit = EXPLORER_RECENT_LIMIT,
  signal?: AbortSignal
): Promise<ResumenBusquedaUi[]> {
  const respuesta = await fetch(`/api/catastro/searches/recent?limit=${limit}`, { signal });
  if (!respuesta.ok) throw errorHttp(respuesta.status, ERROR_RECIENTES);
  const cuerpo = (await respuesta.json()) as { ok: true; searches: ResumenBusquedaUi[] };
  return cuerpo.searches;
}

export async function fetchBusquedaPersistida(
  id: string,
  query: { limit?: number; offset?: number } = {},
  signal?: AbortSignal
): Promise<BusquedaRecuperadaUi> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? EXPLORER_RESULTS_PAGE_SIZE));
  params.set("offset", String(query.offset ?? 0));
  const respuesta = await fetch(`/api/catastro/searches/${encodeURIComponent(id)}?${params}`, {
    signal,
  });
  if (!respuesta.ok) {
    throw errorHttp(respuesta.status, "No se ha podido recuperar la búsqueda.", ERROR_BUSQUEDA_404);
  }
  return (await respuesta.json()) as BusquedaRecuperadaUi;
}

export async function fetchFincaPersistida(
  fincaReference: string,
  signal?: AbortSignal
): Promise<FincaPersistidaUi> {
  const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}`, {
    signal,
  });
  if (!respuesta.ok) {
    throw errorHttp(respuesta.status, "No se ha podido cargar la finca.", ERROR_FINCA_404);
  }
  return (await respuesta.json()) as FincaPersistidaUi;
}

export const ERROR_CREAR_PROPIEDAD = "No se ha podido crear la propiedad.";

export async function crearPropiedadDesdeFincaUi(
  fincaReference: string,
  ofertanteId: string
): Promise<{ created: boolean; link: CatastroPropertyLink }> {
  const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/property`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ofertanteId }),
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { ok: true; created: boolean; link: CatastroPropertyLink }
    | { ok: false; error?: string }
    | null;
  if (!respuesta.ok || !cuerpo || !("ok" in cuerpo) || !cuerpo.ok) {
    throw errorHttp(
      respuesta.status,
      (cuerpo && "error" in cuerpo && cuerpo.error) || ERROR_CREAR_PROPIEDAD,
      ERROR_FINCA_404
    );
  }
  return { created: cuerpo.created, link: cuerpo.link };
}

export async function prepararActualizacionCatastralUi(fincaReference: string): Promise<{
  executed: false;
  lastSeenAt: string | null;
  reciente: boolean;
}> {
  const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/refresh`, {
    method: "POST",
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { ok: true; executed: false; lastSeenAt: string | null; reciente: boolean }
    | { ok: false; error?: string }
    | null;
  if (!respuesta.ok || !cuerpo || !("ok" in cuerpo) || !cuerpo.ok) {
    throw errorHttp(respuesta.status, "No se ha podido localizar la finca.", ERROR_FINCA_404);
  }
  return {
    executed: false,
    lastSeenAt: cuerpo.lastSeenAt,
    reciente: cuerpo.reciente,
  };
}

export async function persistirRevisionUi(
  fincaReference: string,
  status: EstadoRevision
): Promise<void> {
  const respuesta = await fetch("/api/catastro/reviews", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fincaReference, status }),
  });
  if (!respuesta.ok && respuesta.status !== 409) {
    throw errorHttp(respuesta.status, "No se ha podido guardar la revisión.");
  }
}
