export type {
  CatastroExplorerCoverage,
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchCriteria,
  CatastroExplorerSearchCriteriaPostal,
  CatastroExplorerSearchCriteriaStreet,
  CatastroExplorerSearchMode,
  CatastroExplorerSearchResult,
  CatastroExplorerSearchStatus,
  CatastroExplorerTotals,
  CatastroFinca,
  CatastroFincaRecord,
  ExplorerResultsPage,
  ExplorerSearchesPage,
  ExplorerSearchesQuery,
} from "./types";
export {
  EXPLORER_RECENT_LIMIT,
  EXPLORER_RESULTS_PAGE_MAX,
  EXPLORER_RESULTS_PAGE_SIZE,
  EXPLORER_SEARCHES_PAGE_MAX,
  EXPLORER_SEARCHES_PAGE_SIZE,
} from "./types";
export {
  COBERTURA_VACIA,
  TOTALES_VACIOS,
  acotarPaginaHistorico,
  acotarPaginaResultados,
  consultaHistoricoBusquedas,
  actualizarBusqueda,
  crearBusqueda,
  criteriosHaciaCatastro,
  estadoDesdeZona,
  fusionarBusquedaPersistida,
  identidadFinca,
  ordenarBusquedasRecientes,
  recordDesdeFinca,
  resultadoDesdeFinca,
  resumenBusquedaReciente,
  revisionNoCambiaClasificacion,
  tituloBusquedaReciente,
  totalesDesdeFincas,
  validarCriteriosExplorer,
} from "./model";
export { clockSistema } from "./ports";
export type {
  ExplorerAuth,
  ExplorerClock,
  ExplorerIdentity,
  ExplorerResultsQuery,
  ExplorerStore,
} from "./ports";
export { crearStoreMemoriaExplorer, registrarDescubrimiento } from "./store";
export {
  eliminarBusqueda,
  estadoZonaHaciaExplorer,
  persistirBusqueda,
  persistirDescubrimientos,
  persistirRevision,
  propuestaBusqueda,
} from "./persist";
export { consultaGoogleMaps, crearGoogleMapsUrl } from "./maps";
export type { FincaParaMaps } from "./maps";
export {
  crearOReutilizarPropiedad,
  datosPropiedadDesdeFinca,
  etiquetasVinculoPropiedad,
  filtrarPorVinculoPropiedad,
  puedeCrearPropiedadDesdeClasificacion,
  rutaPropiedadCrm,
  esOrigenCatastroExplorer,
  coincideOrigenCatastral,
  coincideDhCatastro,
  fincaReferenceDesdeVinculo,
  ofertanteParaAltaCatastro,
  frescuraInformacionCatastral,
  fechasCatastroYProperty,
  actualizarDatosDesdeCatastro,
  CATASTRO_STALE_MS,
  ORIGEN_CATASTRO_EXPLORER,
  TEXTO_BADGE_CATASTRO,
  TEXTO_BADGE_VINCULADA,
  TEXTO_FUENTE_CATASTRO,
  FILTROS_VINCULO_PROPERTY,
  FILTROS_ORIGEN_CATASTRAL,
  FILTROS_DH_PROPERTY,
  ERRORES_VINCULO_HTTP,
} from "./property-link";
export type { FiltroVinculoProperty, FiltroOrigenCatastral, FiltroDhProperty } from "./property-link";
export type {
  CatastroPropertyIntegration,
  CatastroPropertyLink,
  DatosPropiedadDesdeCatastro,
  OrigenCatastroExplorer,
  ResultadoVinculoPropiedad,
  ResultadoActualizacionCatastro,
} from "./property-port";
