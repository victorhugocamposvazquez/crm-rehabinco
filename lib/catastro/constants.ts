/**
 * Servicios web libres de la Sede Electrónica del Catastro (DGC).
 * Fuente: https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf (v2.6)
 * Help JSON: /OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/help
 *
 * No se usan servicios protegidos (titularidad / valor).
 */

export const CATASTRO_CALLEJERO_JSON =
  "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json";

/** WFS INSPIRE de direcciones. Docs: webinspire/documentos/inspire-ad-WFS.pdf */
export const CATASTRO_INSPIRE_AD_WFS = "https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx";

/** Límite documentado del WFS AD: 5000 elementos / 4 km². */
export const INSPIRE_AD_MAX_FEATURES = 5000;

/**
 * Tope operativo por defecto de Consulta_DNPLOC por calle.
 * No es el número de portales descubiertos: INSPIRE puede devolver más.
 */
export const DEFAULT_MAX_PORTALS = 200;

/** Concurrencia por defecto al resolver portales. El HTTP sigue serializado a 400 ms. */
export const DEFAULT_DISCOVERY_CONCURRENCY = 5;

/** Techo de seguridad: no se permiten oleadas simultáneas contra Catastro. */
export const MAX_DISCOVERY_CONCURRENCY = 10;

/** Límites de la API HTTP. El cliente no puede superarlos. */
export const API_DEFAULT_MAX_PORTALS = 40;
export const API_MAX_PORTALS = 80;
export const API_DEFAULT_CONCURRENCY = 5;
export const API_MAX_CONCURRENCY = 5;

/** Estado temporal de una calle paginada. Sin Redis/Postgres en esta fase. */
export const DISCOVERY_SESSION_TTL_MS = 15 * 60 * 1000;
export const DISCOVERY_SESSION_MAX = 50;

/** Catálogo (provincias / municipios / calles). Cambia poco; no usar Redis. */
export const CATALOG_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const CATALOG_MAX_PARAM_LENGTH = 80;

/**
 * Búsqueda por zona (municipio + CP): recorre las calles oficiales con un pool propio.
 * Independiente de la concurrencia de portales: 2 calles × 5 portales como máximo por defecto.
 */
export const ZONE_DEFAULT_CONCURRENCY = 2;
export const ZONE_MAX_CONCURRENCY = 5;
/** Portales por página dentro de cada calle; páginas cortas = pasos cortos. */
export const ZONE_STREET_PAGE_SIZE = 20;
/** Cada paso HTTP trabaja como máximo este tiempo y devuelve el progreso. */
export const ZONE_STEP_DEFAULT_BUDGET_MS = 15_000;
export const ZONE_STEP_MAX_BUDGET_MS = 25_000;
/** Sesiones de zona en memoria (misma pestaña puede cancelar y reanudar). */
export const ZONE_SESSION_TTL_MS = 60 * 60 * 1000;
export const ZONE_SESSION_MAX = 20;
export const ZONE_MAX_ACTIVE_PER_USER = 2;
/**
 * Tamaño de un bloque de calles. Un municipio pequeño cabe en uno;
 * A Coruña (~15.000) se recorre bloque a bloque para no perder la sesión.
 */
export const ZONE_MAX_STREETS_RUN = 250;
/**
 * Protección: con estos fallos de servicio seguidos (sin ningún éxito entre medias) la zona
 * se pausa en vez de martillear Catastro. Los HTTP 4xx de una calle concreta no cuentan.
 */
export const ZONE_MAX_CONSECUTIVE_FAILURES = 6;
export const ZONE_MAX_ERRORS_REPORTED = 50;

export const CATASTRO_OPERATIONS = {
  provincias: "ObtenerProvincias",
  municipios: "ObtenerMunicipios",
  callejero: "ObtenerCallejero",
  numerero: "ObtenerNumerero",
  dnploc: "Consulta_DNPLOC",
  dnprc: "Consulta_DNPRC",
  dnppp: "Consulta_DNPPP",
} as const;

export type CatastroOperation =
  (typeof CATASTRO_OPERATIONS)[keyof typeof CATASTRO_OPERATIONS];

/** Anexo II del documento oficial de servicios libres. */
export const TIPOS_VIA_OFICIALES: ReadonlyArray<{
  codigo: string;
  nombres: readonly string[];
}> = [
  { codigo: "AC", nombres: ["ACCESO"] },
  { codigo: "AG", nombres: ["AGREGADO"] },
  { codigo: "AL", nombres: ["ALDEA", "ALAMEDA"] },
  { codigo: "AN", nombres: ["ANDADOR"] },
  { codigo: "AR", nombres: ["AREA", "ARRABAL"] },
  { codigo: "AU", nombres: ["AUTOPISTA"] },
  { codigo: "AV", nombres: ["AVENIDA"] },
  { codigo: "AY", nombres: ["ARROYO"] },
  { codigo: "BJ", nombres: ["BAJADA"] },
  { codigo: "BL", nombres: ["BLOQUE"] },
  { codigo: "BO", nombres: ["BARRIO"] },
  { codigo: "BQ", nombres: ["BARRANQUIL"] },
  { codigo: "BR", nombres: ["BARRANCO"] },
  { codigo: "CA", nombres: ["CAÑADA"] },
  { codigo: "CG", nombres: ["COLEGIO", "CIGARRAL"] },
  { codigo: "CH", nombres: ["CHALET"] },
  { codigo: "CI", nombres: ["CINTURON"] },
  { codigo: "CJ", nombres: ["CALLEJA", "CALLEJON"] },
  { codigo: "CL", nombres: ["CALLE"] },
  { codigo: "CM", nombres: ["CAMINO", "CARMEN"] },
  { codigo: "CN", nombres: ["COLONIA"] },
  { codigo: "CO", nombres: ["CONCEJO", "COLEGIO"] },
  { codigo: "CP", nombres: ["CAMPA", "CAMPO"] },
  { codigo: "CR", nombres: ["CARRETERA", "CARRERA"] },
  { codigo: "CS", nombres: ["CASERIO"] },
  { codigo: "CT", nombres: ["CUESTA", "COSTANILLA"] },
  { codigo: "CU", nombres: ["CONJUNTO"] },
  { codigo: "CY", nombres: ["CALEYA"] },
  { codigo: "CZ", nombres: ["CALLIZO"] },
  { codigo: "DE", nombres: ["DETRAS"] },
  { codigo: "DP", nombres: ["DIPUTACION"] },
  { codigo: "DS", nombres: ["DISEMINADOS"] },
  { codigo: "ED", nombres: ["EDIFICIOS"] },
  { codigo: "EM", nombres: ["EXTRAMUROS"] },
  { codigo: "EN", nombres: ["ENTRADA", "ENSANCHE"] },
  { codigo: "EP", nombres: ["ESPALDA"] },
  { codigo: "ER", nombres: ["EXTRARRADIO"] },
  { codigo: "ES", nombres: ["ESCALINATA"] },
  { codigo: "EX", nombres: ["EXPLANADA"] },
  { codigo: "FC", nombres: ["FERROCARRIL"] },
  { codigo: "FN", nombres: ["FINCA"] },
  { codigo: "GL", nombres: ["GLORIETA"] },
  { codigo: "GR", nombres: ["GRUPO"] },
  { codigo: "GV", nombres: ["GRAN VIA"] },
  { codigo: "HT", nombres: ["HUERTA", "HUERTO"] },
  { codigo: "JR", nombres: ["JARDINES"] },
  { codigo: "LA", nombres: ["LAGO"] },
  { codigo: "LD", nombres: ["LADO", "LADERA"] },
  { codigo: "LG", nombres: ["LUGAR"] },
  { codigo: "MA", nombres: ["MALECON"] },
  { codigo: "MC", nombres: ["MERCADO"] },
  { codigo: "ML", nombres: ["MUELLE"] },
  { codigo: "MN", nombres: ["MUNICIPIO"] },
  { codigo: "MS", nombres: ["MASIAS"] },
  { codigo: "MT", nombres: ["MONTE"] },
  { codigo: "MZ", nombres: ["MANZANA"] },
  { codigo: "PB", nombres: ["POBLADO"] },
  { codigo: "PC", nombres: ["PLACETA"] },
  { codigo: "PD", nombres: ["PARTIDA"] },
  { codigo: "PI", nombres: ["PARTICULAR"] },
  { codigo: "PJ", nombres: ["PASAJE", "PASADIZO"] },
  { codigo: "PL", nombres: ["POLIGONO"] },
  { codigo: "PM", nombres: ["PARAMO"] },
  { codigo: "PQ", nombres: ["PARROQUIA", "PARQUE"] },
  { codigo: "PR", nombres: ["PROLONGACION", "CONTINUAC."] },
  { codigo: "PS", nombres: ["PASEO"] },
  { codigo: "PT", nombres: ["PUENTE"] },
  { codigo: "PU", nombres: ["PASADIZO"] },
  { codigo: "PZ", nombres: ["PLAZA"] },
  { codigo: "QT", nombres: ["QUINTA"] },
  { codigo: "RA", nombres: ["RACONADA"] },
  { codigo: "RB", nombres: ["RAMBLA"] },
  { codigo: "RC", nombres: ["RINCON", "RINCONA"] },
  { codigo: "RD", nombres: ["RONDA"] },
  { codigo: "RM", nombres: ["RAMAL"] },
  { codigo: "RP", nombres: ["RAMPA"] },
  { codigo: "RR", nombres: ["RIERA"] },
  { codigo: "RU", nombres: ["RUA"] },
  { codigo: "SA", nombres: ["SALIDA"] },
  { codigo: "SC", nombres: ["SECTOR"] },
  { codigo: "SD", nombres: ["SENDA"] },
  { codigo: "SL", nombres: ["SOLAR"] },
  { codigo: "SN", nombres: ["SALON"] },
  { codigo: "SU", nombres: ["SUBIDA"] },
  { codigo: "TN", nombres: ["TERRENOS"] },
  { codigo: "TO", nombres: ["TORRENTE"] },
  { codigo: "TR", nombres: ["TRAVESIA"] },
  { codigo: "UR", nombres: ["URBANIZACION"] },
  { codigo: "VA", nombres: ["VALLE"] },
  { codigo: "VD", nombres: ["VIADUCTO"] },
  { codigo: "VI", nombres: ["VIA"] },
  { codigo: "VL", nombres: ["VIAL"] },
  { codigo: "VR", nombres: ["VEREDA"] },
];

export const DEFAULT_MIN_INTERVAL_MS = 400;
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_TIMEOUT_MS = 20_000;
export const CATASTRO_USER_AGENT = "RehabincoCRM-CatastroExplorer/0.1";
