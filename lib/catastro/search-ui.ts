/**
 * Adaptador de presentación para GET /api/catastro/search.
 * No clasifica fincas ni consulta Catastro: solo URL, fetch y copy.
 */
import { etiquetaMotivoUnknownUi } from "./unknown-reason";

export const FILTRO_DIVISION_POR_DEFECTO = "NO" as const;

export const FILTROS_DIVISION = [
  { value: "NO", label: "Candidatas (sin DH)" },
  { value: "YES", label: "Con división horizontal" },
  { value: "UNKNOWN", label: "Sin clasificar" },
  { value: "NOT_APPLICABLE", label: "No aplicable" },
  { value: "ALL", label: "Todas las fincas" },
] as const;

export const AYUDA_FILTRO_DIVISION =
  "Por defecto solo ves parcelas o edificios que Catastro no tiene partidos en pisos. Es lo habitual para reforma. Si la lista sale vacía, elige «Todas las fincas».";

export type FiltroDivisionUi = (typeof FILTROS_DIVISION)[number]["value"];

export type CriteriosBusquedaUi = {
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero: string;
  postalCode: string;
  horizontalDivision: string;
};

export type FincaBusquedaUi = {
  fincaReference: string;
  portals: string[];
  address: {
    provincia?: string | null;
    municipio?: string | null;
    sigla?: string | null;
    via?: string | null;
    numero?: string;
    numero2?: string;
    literal?: string;
  };
  postalCode?: string;
  postalCodes?: string[];
  superficieSolar?: number;
  horizontalDivision?: { status?: string; reasonCode?: string };
  properties?: Array<{
    reference: string;
    postalCode?: string;
    superficie?: number;
    anio?: number;
    uso?: string;
    bloque?: string;
    escalera?: string;
    planta?: string;
    puerta?: string;
  }>;
};

export type ResultadoBusquedaUi = {
  ok: true;
  search: {
    provincia: string;
    municipio: string;
    sigla: string;
    via: string;
    numero?: string;
    postalCode?: string;
    horizontalDivision: string;
  };
  results: FincaBusquedaUi[];
  pagination: {
    hasNextPage: boolean;
    nextCursor?: string;
  };
  coverage: {
    complete: boolean;
    completeCandidates: boolean;
    possibleCut: boolean;
    portalsFound: number;
    portalsProcessed: number;
  };
};

const FILTROS_VALIDOS = new Set<string>(FILTROS_DIVISION.map((item) => item.value));

export function criteriosVacios(): CriteriosBusquedaUi {
  return {
    provincia: "",
    municipio: "",
    sigla: "CL",
    via: "",
    numero: "",
    postalCode: "",
    horizontalDivision: FILTRO_DIVISION_POR_DEFECTO,
  };
}

export function criteriosDesdeSearchParams(params: URLSearchParams): CriteriosBusquedaUi {
  const filtro = (params.get("horizontalDivision") ?? "").trim().toUpperCase();
  return {
    provincia: params.get("provincia")?.trim() ?? "",
    municipio: params.get("municipio")?.trim() ?? "",
    sigla: (params.get("sigla") ?? "CL").trim().toUpperCase() || "CL",
    via: (params.get("via") ?? params.get("calle") ?? "").trim(),
    numero: (params.get("numero") ?? "").trim(),
    postalCode: (params.get("postalCode") ?? params.get("codigoPostal") ?? "").trim(),
    horizontalDivision: FILTROS_VALIDOS.has(filtro) ? filtro : FILTRO_DIVISION_POR_DEFECTO,
  };
}

export function searchParamsDesdeCriterios(criterios: CriteriosBusquedaUi): URLSearchParams {
  const params = new URLSearchParams();
  const provincia = criterios.provincia.trim();
  const municipio = criterios.municipio.trim();
  const sigla = criterios.sigla.trim().toUpperCase();
  const via = criterios.via.trim();
  const numero = criterios.numero.trim();
  const postalCode = criterios.postalCode.trim();
  const filtro = criterios.horizontalDivision.trim().toUpperCase();

  if (provincia) params.set("provincia", provincia);
  if (municipio) params.set("municipio", municipio);
  if (sigla) params.set("sigla", sigla);
  if (via) params.set("via", via);
  if (numero) params.set("numero", numero);
  if (postalCode) params.set("postalCode", postalCode);
  params.set(
    "horizontalDivision",
    FILTROS_VALIDOS.has(filtro) ? filtro : FILTRO_DIVISION_POR_DEFECTO
  );
  return params;
}

export function criteriosListos(criterios: CriteriosBusquedaUi): boolean {
  return Boolean(
    criterios.provincia.trim() &&
      criterios.municipio.trim() &&
      criterios.sigla.trim() &&
      criterios.via.trim()
  );
}

export function claveCriterios(criterios: CriteriosBusquedaUi): string {
  return [
    criterios.provincia,
    criterios.municipio,
    criterios.sigla,
    criterios.via,
    criterios.numero,
    criterios.postalCode,
    criterios.horizontalDivision,
  ]
    .map((valor) => valor.trim().toUpperCase())
    .join("|");
}

export function mensajeErrorBusqueda(status: number): string {
  if (status === 400) return "Revisa los datos introducidos.";
  if (status === 401) return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  if (status === 404) return "No hemos encontrado esa calle o ubicación en Catastro.";
  if (status === 410) return "La búsqueda ha caducado. Vuelve a pulsar Buscar.";
  if (status === 502) return "Catastro no está disponible en este momento. Inténtalo de nuevo.";
  return "No se ha podido completar la búsqueda. Inténtalo de nuevo.";
}

export function etiquetaEstadoDivision(status: string | undefined): string {
  if (status === "NO") return "SIN DIVISIÓN HORIZONTAL";
  if (status === "YES") return "CON DIVISIÓN HORIZONTAL";
  if (status === "NOT_APPLICABLE") return "NO APLICA";
  return "NO DETERMINADO";
}

/** Etiqueta corta para listados. El CSV sigue usando `etiquetaEstadoDivision`. */
export function etiquetaEstadoDivisionLista(status: string | undefined): string {
  if (status === "NO") return "Candidata";
  if (status === "YES") return "Con pisos";
  if (status === "NOT_APPLICABLE") return "No aplica";
  return "Sin clasificar";
}

export function resumenComercialFinca(finca: Pick<FincaBusquedaUi, "horizontalDivision" | "superficieSolar" | "properties">): string {
  const status = finca.horizontalDivision?.status;
  const inmuebles = finca.properties?.length ?? 0;
  const partes: string[] = [];
  if (status === "NO") partes.push("Sin dividir en pisos");
  else if (status === "YES") partes.push("Ya tiene división horizontal");
  else if (status === "NOT_APPLICABLE") partes.push("Tipología no aplicable a reforma de edificio");
  else partes.push("Catastro no aclara si está dividida");
  if (finca.superficieSolar != null) partes.push(`${finca.superficieSolar} m² de parcela`);
  if (inmuebles === 1) partes.push("1 inmueble");
  if (inmuebles > 1) partes.push(`${inmuebles} inmuebles`);
  return partes.join(" · ");
}

export function textoVacioResultados(filtro: string): {
  mensaje: string;
  accion?: { label: string; filtro: "ALL" };
} {
  if (filtro.trim().toUpperCase() === "NO") {
    return {
      mensaje:
        "No hay fincas candidatas (sin división horizontal) en esta búsqueda. En calles de pisos es lo normal.",
      accion: { label: "Ver todas las fincas", filtro: "ALL" },
    };
  }
  return {
    mensaje: "No se han encontrado fincas que cumplan los filtros seleccionados.",
  };
}

/** Subtítulo opcional bajo NO DETERMINADO. Nunca «SIN DIVISIÓN HORIZONTAL». */
export function textoMotivoUnknownUi(
  horizontalDivision?: { status?: string; reasonCode?: string }
): string | null {
  if (horizontalDivision?.status !== "UNKNOWN") return null;
  return etiquetaMotivoUnknownUi(horizontalDivision.reasonCode);
}

export function textoContadorFincas(total: number): string {
  if (total === 1) return "1 finca encontrada";
  return `${total} fincas encontradas`;
}

export function textosCobertura(input: {
  complete: boolean;
  completeCandidates: boolean;
  hasNextPage: boolean;
  possibleCut: boolean;
}): { completa: string | null; masResultados: string | null; corte: string | null } {
  return {
    completa:
      input.completeCandidates && input.complete
        ? "Búsqueda completa"
        : null,
    masResultados: input.hasNextPage
      ? "Hay más portales en esta calle. Pulsa Siguiente para continuar."
      : null,
    corte: input.possibleCut
      ? "Catastro indica que esta zona puede contener más resultados de los recuperados."
      : null,
  };
}

/**
 * `snp` oficial (BIS, A…). Catastro envía `"0"` cuando no hay segundo número
 * (el `ldt` oficial dice «CL FUENCARRAL 13», no «130»): se trata como vacío.
 */
export function numeroSecundarioOficial(finca: Pick<FincaBusquedaUi, "address">): string {
  const valor = finca.address.numero2?.trim() ?? "";
  return valor === "0" ? "" : valor;
}

export function tituloDireccionFinca(finca: FincaBusquedaUi): string {
  const via = [finca.address.sigla, finca.address.via].filter(Boolean).join(" ").trim();
  const numero = finca.address.numero
    ? `${finca.address.numero}${numeroSecundarioOficial(finca)}`
    : finca.portals.length === 1
      ? finca.portals[0]
      : null;
  if (via && numero) return `${via} ${numero}`;
  if (via) return via;
  return finca.address.literal?.trim() || "Finca catastral";
}

export function codigosPostalesVisibles(finca: FincaBusquedaUi): string[] {
  if (finca.postalCodes && finca.postalCodes.length > 0) return finca.postalCodes;
  return finca.postalCode ? [finca.postalCode] : [];
}

export async function fetchBusquedaCatastro(
  criterios: CriteriosBusquedaUi,
  cursor: string | undefined,
  signal: AbortSignal
): Promise<ResultadoBusquedaUi> {
  const params = searchParamsDesdeCriterios(criterios);
  if (cursor) params.set("cursor", cursor);

  const respuesta = await fetch(`/api/catastro/search?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    signal,
  });

  if (!respuesta.ok) {
    throw new ErrorBusquedaUi(respuesta.status, mensajeErrorBusqueda(respuesta.status));
  }

  const cuerpo = (await respuesta.json()) as ResultadoBusquedaUi;
  if (!cuerpo?.ok || !Array.isArray(cuerpo.results)) {
    throw new ErrorBusquedaUi(502, mensajeErrorBusqueda(502));
  }
  return cuerpo;
}

export class ErrorBusquedaUi extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ErrorBusquedaUi";
    this.status = status;
  }
}

