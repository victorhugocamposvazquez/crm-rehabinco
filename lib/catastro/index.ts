export { createCatastroClient, getCatastroClient } from "./client";
export type { CatastroClient } from "./client";
export { CatastroHttpError } from "./http";
export {
  asArray,
  componerReferencia,
  parseConsultaDnp,
  parseNumeroCatastral,
  separarTipoVia,
} from "./parse";
export {
  detectHorizontalDivision,
  evidenciaDesdeConsulta,
  RAZON_UNKNOWN_ERROR,
  RAZON_UNKNOWN_LTP_AUSENTE,
  RAZON_UNKNOWN_LTP_NO_RECONOCIDO,
} from "./horizontal-division";
export type {
  DetectHorizontalDivisionInput,
  EstadoDivisionHorizontal,
  EvidenciaDivisionHorizontal,
  ResultadoDivisionHorizontal,
} from "./horizontal-division";
export { causaUnknownDe, muestraUnknown, recuentoCausasUnknown } from "./unknown-cause";
export type { CausaUnknown, RecuentoCausasUnknown } from "./unknown-cause";
export {
  LTP_MIXTO_URBANO_RUSTICO,
  etiquetaMotivoUnknownCsv,
  etiquetaMotivoUnknownUi,
  reasonCodeUnknownDe,
  recuentoReasonCodeUnknown,
} from "./unknown-reason";
export type { UnknownReason } from "./unknown-reason";
export {
  casoUnknownDe,
  cuboLcons,
  cuboRc,
  grupoUsoDe,
  grupoUsoDeUno,
  recuentoGruposUso,
} from "./unknown-profile";
export type { CasoUnknown, CuboLcons, CuboRc, GrupoUsoUnknown } from "./unknown-profile";
export { CATALOGO_LTP } from "./ltp-catalogo";
export {
  ESTADO_NOT_APPLICABLE,
  evaluarAplicabilidadDh,
  evidenciaSueloOficial,
  ldtIndicaSuelo,
  usoIndicaObrasUrbanizacion,
  usoIndicaSueloSinEdificar,
} from "./applicability";
export type { EstadoDhFinca, ResultadoAplicabilidadDh } from "./applicability";
export {
  agruparPorFinca,
  clasificarFincaPorLtp,
  esReferenciaInmueble,
  getFincaReference,
  referenciaParcelaDe,
  resolverDivisionHorizontal,
  seleccionarReferenciaDetalle,
} from "./resolve-finca-ltp";
export {
  esReferenciaFinca,
  getPropertyReference,
  LONGITUD_FINCA,
  LONGITUD_INMUEBLE,
  normalizarReferencia,
} from "./references";
export {
  coincideCodigoPostal,
  codigoPostalDePropiedad,
  filtrarPropiedadesPorCodigoPostal,
  fincaPuedePertenecerAlCodigoPostal,
  propiedadesDesdeInmuebles,
  seleccionarFincasParaResolverLtp,
  PREFILTRO_CODIGO_POSTAL_VACIO,
} from "./finca";
export type {
  DireccionFinca,
  FincaDescubierta,
  InmuebleDeFinca,
  PrefiltroCodigoPostal,
} from "./finca";
export { discoverFincas, DiscoverySessionError } from "./discovery";
export type {
  DiscoveryInput,
  DiscoveryMeta,
  DiscoveryOptions,
  DiscoveryQuery,
  DiscoveryResult,
  FincaDescubierta,
  PortalDescubierto,
} from "./discovery";
export {
  createDiscoveryStore,
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
} from "./discovery-session";
export { parsearBusqueda, responderBusquedaCatastro } from "./search";
export {
  clasificarCandidatos,
  filtrarPorDivision,
  fusionarFincas,
  getNonHorizontalDivisionFincas,
  parsearFiltroDivision,
} from "./candidates";
export type { ClasificacionCandidatos, FiltroDivisionHorizontal } from "./candidates";
export { parsearDiscovery, responderDiscoveryCatastro } from "./search-discovery";
export {
  buscarFincasComerciales,
  compararNumeroOficial,
  deduplicarFincas,
  normalizarCriterios,
  ordenarFincasComerciales,
} from "./commercial-search";
export type {
  CriteriosBusquedaComercial,
  ResultadoBusquedaComercial,
} from "./commercial-search";
export { parsearCriteriosComerciales, responderBusquedaComercial } from "./search-commercial";
export {
  createCatalogCache,
  getCatalogCache,
  obtenerCallejeroOficial,
  parsearCalles,
  parsearMunicipios,
  parsearProvincias,
  responderCalles,
  responderMunicipios,
  responderProvincias,
} from "./catalog";
export type {
  CalleCatalogo,
  CallejeroOficial,
  MunicipioCatalogo,
  ProvinciaCatalogo,
} from "./catalog";
export {
  cancelarZona,
  coberturaZona,
  ejecutarPasoZona,
  normalizarCriteriosZona,
  ordenarFincasZona,
  prepararZona,
  reanudarZona,
  snapshotZona,
  ZoneBusyError,
} from "./zone-search";
export type {
  CoberturaZona,
  CriteriosZona,
  CriteriosZonaNormalizados,
  ErrorCalleZona,
  ProgresoZona,
  ZoneDeps,
  ZoneSnapshot,
  ZoneStatus,
} from "./zone-search";
export { createZoneStore, getZoneStore } from "./zone-session";
export type { ZoneSession, ZoneSessionStore } from "./zone-session";
export {
  responderZonaCancelar,
  responderZonaEstado,
  responderZonaPaso,
  responderZonaPreparar,
  responderZonaReanudar,
} from "./search-zone";
export {
  AVISO_FALLBACK_CATALOGO,
  CATALOG_CLIENT_TTL_MS,
  CATALOG_CLIENT_VERSION,
  cargarCatalogo,
  claveCacheCalles,
  claveCacheMunicipios,
  claveCacheProvincias,
  crearSelectorCatalogo,
  crearStoreIndexedDb,
  crearStoreMemoria,
  esEntradaCatalogo,
  getCatalogClientStore,
} from "./catalog-client-cache";
export type {
  CatalogStore,
  EntradaCatalogo,
  EstadoCatalogo,
  MetricaCatalogo,
} from "./catalog-client-cache";
export {
  AVISO_EXPORTACION_CORTE,
  AVISO_EXPORTACION_INCOMPLETA,
  COLUMNAS_CSV,
  SELECCION_VACIA,
  advertenciaExportacion,
  alternarSeleccion,
  coberturaExportacion,
  csvDesdeFincas,
  detalleFinca,
  direccionOficial,
  escaparCsv,
  estaSeleccionada,
  generarCsv,
  nombreArchivoExportacion,
  prepararExportacionCsv,
  prepararExportacionRevisionCsv,
  seleccionParaBusqueda,
} from "./selection-export";
export type { ExportacionPreparada, SeleccionFincas } from "./selection-export";
export {
  FILTROS_REVISION_COMERCIAL,
  REVISION_VACIA,
  alternarRevision,
  estadoRevisionDe,
  estaEnRevision,
  filtrarPorRevisionComercial,
  etiquetaEstadoComercial,
  limpiarRevision,
  marcarRevision,
  puedeMarcarseRevision,
  quitarRevision,
  revisionParaBusqueda,
  textoBarraSeleccionYRevision,
  textoRevision,
  textoRevisionUi,
} from "./revision-comercial";
export type {
  EstadoRevision,
  FiltroRevisionComercial,
  RevisionFincas,
} from "./revision-comercial";
export type {
  DiscoveryApiError,
  DiscoveryApiFinca,
  DiscoveryApiOk,
  DiscoveryApiQuery,
} from "./search-discovery";
export {
  API_DEFAULT_CONCURRENCY,
  API_DEFAULT_MAX_PORTALS,
  API_MAX_CONCURRENCY,
  API_MAX_PORTALS,
  CATASTRO_CALLEJERO_JSON,
  CATASTRO_OPERATIONS,
  DEFAULT_DISCOVERY_CONCURRENCY,
  DEFAULT_MAX_PORTALS,
  TIPOS_VIA_OFICIALES,
  ZONE_DEFAULT_CONCURRENCY,
  ZONE_MAX_ACTIVE_PER_USER,
  ZONE_MAX_CONCURRENCY,
  ZONE_MAX_CONSECUTIVE_FAILURES,
  ZONE_SESSION_TTL_MS,
  ZONE_STEP_DEFAULT_BUDGET_MS,
  ZONE_STEP_MAX_BUDGET_MS,
  ZONE_STREET_PAGE_SIZE,
} from "./constants";
export type {
  CatastroClientOptions,
  ConsultaDireccion,
  ConsultaReferencia,
  ErrorCatastro,
  FincaCatastro,
  InmuebleNormalizado,
  ResultadoConsultaCatastro,
} from "./types";
export {
  crearBusqueda,
  crearStoreMemoriaExplorer,
  criteriosHaciaCatastro,
  identidadFinca,
  ordenarBusquedasRecientes,
  persistirBusqueda,
  persistirRevision,
  eliminarBusqueda,
  propuestaBusqueda,
  registrarDescubrimiento,
  resumenBusquedaReciente,
  tituloBusquedaReciente,
  totalesDesdeFincas,
  crearGoogleMapsUrl,
  consultaGoogleMaps,
} from "./explorer";
export type {
  CatastroExplorerReview,
  CatastroExplorerSearch,
  CatastroExplorerSearchCriteria,
  CatastroExplorerSearchResult,
  CatastroFinca,
  CatastroFincaRecord,
  ExplorerStore,
} from "./explorer";
