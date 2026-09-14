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
import { ZONE_MAX_STREETS_RUN } from "../constants";
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
export const RUTA_NUEVA_BUSQUEDA = "/catastro";
export const RUTA_HISTORICO = "/catastro/searches";

export function rutaBusquedaHistorica(id: string): string {
  return `${RUTA_EXPLORER}/searches/${id}`;
}

export function rutaFincaPersistida(fincaReference: string): string {
  return `${RUTA_EXPLORER}/finca/${fincaReference}`;
}

const RUTA_RESULTADOS_HISTORICA = /^\/catastro\/searches\/([^/]+)$/;
export const CLAVE_ULTIMA_RESULTADOS = "catastro:ultima-resultados";

export function esRutaResultadosHistorica(pathname: string): boolean {
  return RUTA_RESULTADOS_HISTORICA.test(pathname);
}

export function recordarRutaResultados(
  pathname: string,
  storage?: Pick<Storage, "setItem"> | null
): void {
  if (!esRutaResultadosHistorica(pathname)) return;
  const destino = storage ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
  destino?.setItem(CLAVE_ULTIMA_RESULTADOS, pathname);
}

export function recordarResultadosPorId(
  searchId: string,
  storage?: Pick<Storage, "setItem"> | null
): void {
  const id = searchId.trim();
  if (!id) return;
  recordarRutaResultados(rutaBusquedaHistorica(id), storage);
}

export function leerRutaResultados(storage?: Pick<Storage, "getItem"> | null): string | null {
  const origen = storage ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
  const valor = origen?.getItem(CLAVE_ULTIMA_RESULTADOS)?.trim() ?? "";
  return esRutaResultadosHistorica(valor) ? valor : null;
}

/**
 * Resultados es el último rastreo persistido (`/catastro/searches/:id`).
 * Nunca vuelve a `/catastro`: eso es Buscar y recarga el formulario.
 */
export function destinoResultadosCatastro(
  pathname: string,
  ultima: string | null = null
): { href: string; scrollLocal: boolean; activa: boolean } {
  if (esRutaResultadosHistorica(pathname)) {
    return { href: pathname, scrollLocal: false, activa: true };
  }
  if (ultima && esRutaResultadosHistorica(ultima)) {
    return { href: ultima, scrollLocal: false, activa: false };
  }
  return { href: RUTA_HISTORICO, scrollLocal: false, activa: false };
}

export const TEXTO_REANUDAR_BUSQUEDA = "Reanudar";

export function puedeReanudarHistorica(input: {
  mode: CatastroExplorerSearch["criteria"]["mode"];
  status: CatastroExplorerSearchStatus;
  coverage?: Pick<CatastroExplorerCoverage, "complete" | "streetsFound" | "streetsProcessed">;
}): boolean {
  if (input.mode !== "POSTAL_CODE") return false;
  if (input.status === "COMPLETED") {
    const encontradas = input.coverage?.streetsFound ?? 0;
    const procesadas = input.coverage?.streetsProcessed ?? 0;
    return !input.coverage?.complete && encontradas > procesadas;
  }
  return true;
}

export function urlReanudarBusqueda(
  searchId: string,
  criteria?: CatastroExplorerSearchCriteria
): string {
  const params = new URLSearchParams({ continuar: searchId, modo: "zona" });
  if (criteria?.mode === "POSTAL_CODE") {
    params.set("provincia", criteria.provincia);
    params.set("municipio", criteria.municipio);
    params.set("postalCode", criteria.postalCode);
    if (criteria.horizontalDivision) params.set("horizontalDivision", criteria.horizontalDivision);
  }
  return `${RUTA_EXPLORER}?${params}`;
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
export const TEXTO_VER_TODO = "Ver historial";
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
  "flex flex-col gap-3 rounded-[13px] border border-[#E6E3DD] bg-white px-3.5 py-3 min-[780px]:flex-row min-[780px]:items-center min-[780px]:justify-between min-[780px]:gap-4 min-[780px]:rounded-none min-[780px]:border-0 min-[780px]:border-b min-[780px]:border-[#F2F0EB] min-[780px]:px-4 min-[780px]:py-3 min-[780px]:last:border-b-0";

export const CLASE_CHIP_ESTADO =
  "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold";

export const CLASES_CHIP_ESTADO: Record<CatastroExplorerSearchStatus, string> = {
  PREPARED: "bg-neutral-100 text-neutral-700",
  RUNNING: "bg-[#E9EEF8] text-[#2B4A8A]",
  PAUSED: "bg-[#FBF0D8] text-[#6A4F0C]",
  CANCELLED: "bg-[#FBF0D8] text-[#6A4F0C]",
  COMPLETED: "bg-[#E8F3EF] text-[#0B7461]",
  FAILED: "bg-red-50 text-red-800",
};

export const CLASES_PUNTO_ESTADO: Record<CatastroExplorerSearchStatus, string> = {
  PREPARED: "bg-neutral-400",
  RUNNING: "bg-[#3B6BC7]",
  PAUSED: "bg-[#C9A227]",
  CANCELLED: "bg-[#C9A227]",
  COMPLETED: "bg-[#0B7461]",
  FAILED: "bg-red-600",
};

export type CoberturaRecienteUi = Pick<
  CatastroExplorerCoverage,
  "complete" | "possibleCut" | "streetsFound" | "streetsProcessed" | "streetsTotal" | "streetOffset"
>;

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

export function recuentoEstadosDesdeTotales(totals: {
  fincas: number;
  candidates: number;
  yes: number;
  unknown: number;
  notApplicable: number;
}): Record<string, number> {
  return {
    ALL: totals.fincas,
    NO: totals.candidates,
    YES: totals.yes,
    UNKNOWN: totals.unknown,
    NOT_APPLICABLE: totals.notApplicable,
  };
}

export type FiltroHistorico = "ALL" | "CANDIDATES" | "UNKNOWN" | "NOT_APPLICABLE" | "REVIEW";

export const FILTROS_HISTORICOS = [
  { value: "ALL", label: "Todos" },
  { value: "CANDIDATES", label: "Candidatos" },
  { value: "UNKNOWN", label: "NO determinados" },
  { value: "NOT_APPLICABLE", label: "No aplicables" },
  { value: "REVIEW", label: "Para revisar" },
] as const;

export const ESTADO_BUSQUEDA_UI: Record<CatastroExplorerSearchStatus, string> = {
  PREPARED: "Lista para empezar",
  RUNNING: "En curso",
  PAUSED: "Pausada",
  CANCELLED: "Pausada",
  COMPLETED: "Completada",
  FAILED: "Con errores",
};

export type ProgresoListaBusqueda = {
  ratio: number;
  etiqueta: string;
};

export function coberturaListaDesdeBusqueda(
  coverage: CatastroExplorerCoverage
): CoberturaRecienteUi {
  return {
    complete: coverage.complete,
    possibleCut: coverage.possibleCut,
    ...(coverage.streetsFound != null ? { streetsFound: coverage.streetsFound } : {}),
    ...(coverage.streetsProcessed != null ? { streetsProcessed: coverage.streetsProcessed } : {}),
    ...(coverage.streetsTotal != null ? { streetsTotal: coverage.streetsTotal } : {}),
    ...(coverage.streetOffset != null ? { streetOffset: coverage.streetOffset } : {}),
  };
}

export function progresoListaBusqueda(input: {
  mode: CatastroExplorerSearch["criteria"]["mode"];
  status: CatastroExplorerSearchStatus;
  coverage?: CoberturaRecienteUi;
}): ProgresoListaBusqueda {
  const coverage = input.coverage;
  if (input.mode === "STREET") {
    return input.status === "COMPLETED"
      ? { ratio: 1, etiqueta: "completo" }
      : { ratio: 0, etiqueta: "" };
  }
  if (coverage?.complete) {
    return { ratio: 1, etiqueta: "completo" };
  }

  const encontradas = coverage?.streetsFound ?? 0;
  const procesadas = coverage?.streetsProcessed ?? 0;
  const total = coverage?.streetsTotal && coverage.streetsTotal > 0 ? coverage.streetsTotal : 0;
  const offset = coverage?.streetOffset ?? 0;

  if (total > 0) {
    const bloques = Math.max(1, Math.ceil(total / ZONE_MAX_STREETS_RUN));
    const indice = Math.min(bloques, Math.floor(offset / ZONE_MAX_STREETS_RUN) + 1);
    const avanzado = Math.min(total, Math.max(0, offset + procesadas));
    return {
      ratio: avanzado / total,
      etiqueta: `bloque ${indice}/${bloques}`,
    };
  }

  if (encontradas > 0) {
    const bloques = Math.max(1, Math.ceil(encontradas / ZONE_MAX_STREETS_RUN));
    return {
      ratio: Math.min(1, procesadas / encontradas),
      etiqueta: `bloque 1/${bloques}`,
    };
  }

  return { ratio: 0, etiqueta: "" };
}

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
    coverage: coberturaListaDesdeBusqueda(search.coverage),
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
  return mode === "POSTAL_CODE" ? "Código postal" : "Calle";
}

export function formatoNumeroEs(valor: number): string {
  return valor.toLocaleString("es-ES");
}

export type UnidadListado = { singular: string; plural: string };

export const UNIDAD_FINCAS: UnidadListado = { singular: "finca", plural: "fincas" };
export const UNIDAD_BUSQUEDAS: UnidadListado = { singular: "búsqueda", plural: "búsquedas" };

/** Cuántas hay a la vista frente al total del listado. Sin páginas. */
export function textoListadoParcial(
  viendo: number,
  total: number,
  unidad: UnidadListado = UNIDAD_FINCAS
): string {
  const cargadas = Math.max(0, Math.floor(viendo) || 0);
  const todas = Math.max(0, Math.floor(total) || 0);
  const nombre = todas === 1 ? unidad.singular : unidad.plural;
  if (todas <= 0) return `Sin ${unidad.plural}`;
  if (cargadas >= todas) return `${formatoNumeroEs(todas)} ${nombre}`;
  return `Viendo ${formatoNumeroEs(cargadas)} de ${formatoNumeroEs(todas)} ${nombre}`;
}

export function acumularFincasLista(
  actuales: FincaBusquedaUi[],
  nuevas: FincaBusquedaUi[]
): FincaBusquedaUi[] {
  if (actuales.length === 0) return nuevas;
  const vistos = new Set(actuales.map((finca) => finca.fincaReference));
  const extra = nuevas.filter((finca) => !vistos.has(finca.fincaReference));
  return extra.length === 0 ? actuales : [...actuales, ...extra];
}

/** Página actual, total de páginas y texto visible. No recarga: solo describe offset/limit. */
export function resumenPaginacion(input: {
  offset: number;
  limit: number;
  total: number;
}): {
  pagina: number;
  paginas: number;
  desde: number;
  hasta: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  rango: string;
  etiqueta: string;
} {
  const limit = Math.max(1, Math.floor(input.limit) || 1);
  const total = Math.max(0, Math.floor(input.total) || 0);
  const offset = Math.max(0, Math.floor(input.offset) || 0);
  const paginas = Math.max(1, Math.ceil(total / limit) || 1);
  const pagina = total === 0 ? 1 : Math.min(paginas, Math.floor(offset / limit) + 1);
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = total === 0 ? 0 : Math.min(total, offset + limit);
  const viendo = total === 0 ? 0 : Math.min(total, offset + limit);
  const rango =
    total === 0
      ? "Sin resultados"
      : `${formatoNumeroEs(desde)}–${formatoNumeroEs(hasta)} de ${formatoNumeroEs(total)}`;
  return {
    pagina,
    paginas,
    desde,
    hasta,
    hayAnterior: offset > 0,
    haySiguiente: hasta < total,
    rango,
    etiqueta: textoListadoParcial(viendo, total),
  };
}

export function offsetDesdePagina(pagina: number, limit: number): number {
  const tamano = Math.max(1, Math.floor(limit) || 1);
  const indice = Math.max(1, Math.floor(pagina) || 1);
  return (indice - 1) * tamano;
}

export function fechaBusquedaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-ES");
}

export function fechaBusquedaLista(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  if (fecha.toLocaleDateString("es-ES") === ahora.toLocaleDateString("es-ES")) return "hoy";
  return fecha.toLocaleDateString("es-ES");
}

export function lineaMetaListaBusqueda(
  item: Pick<ResumenBusquedaUi, "fincas" | "candidatas" | "updatedAt">,
  ahora: Date = new Date()
): string {
  const fincas = `${formatoNumeroEs(item.fincas)} ${item.fincas === 1 ? "finca" : "fincas"}`;
  const candidatas = `${formatoNumeroEs(item.candidatas)} ${item.candidatas === 1 ? "candidata" : "candidatas"}`;
  return `${fincas} · ${candidatas} · ${fechaBusquedaLista(item.updatedAt, ahora)}`;
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
  query: { limit?: number; offset?: number; status?: string } = {},
  signal?: AbortSignal
): Promise<BusquedaRecuperadaUi> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? EXPLORER_RESULTS_PAGE_SIZE));
  params.set("offset", String(query.offset ?? 0));
  if (query.status && query.status !== "ALL") params.set("status", query.status);
  const respuesta = await fetch(`/api/catastro/searches/${encodeURIComponent(id)}?${params}`, {
    signal,
  });
  if (!respuesta.ok) {
    throw errorHttp(respuesta.status, "No se ha podido recuperar la búsqueda.", ERROR_BUSQUEDA_404);
  }
  return (await respuesta.json()) as BusquedaRecuperadaUi;
}

export type MapaCatastralUi = {
  imageUrl: string;
  mapaUrl: string | null;
};

export async function fetchMapaCatastral(
  fincaReference: string,
  signal?: AbortSignal
): Promise<MapaCatastralUi> {
  const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/mapa`, {
    signal,
  });
  const cuerpo = (await respuesta.json().catch(() => null)) as
    | { ok: true; imageUrl: string; mapaUrl?: string | null }
    | { ok: false; error?: string }
    | null;
  if (!respuesta.ok || !cuerpo || !("ok" in cuerpo) || !cuerpo.ok) {
    throw errorHttp(
      respuesta.status,
      (cuerpo && "error" in cuerpo && cuerpo.error) || "No se ha podido cargar el mapa catastral."
    );
  }
  return { imageUrl: cuerpo.imageUrl, mapaUrl: cuerpo.mapaUrl ?? null };
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
  ofertanteId?: string | null
): Promise<{ created: boolean; link: CatastroPropertyLink }> {
  const respuesta = await fetch(`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/property`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ofertanteId: ofertanteId ?? null }),
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
