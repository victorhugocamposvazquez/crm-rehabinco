/**
 * Adaptador de presentación para GET /api/catastro/search.
 * No clasifica fincas ni consulta Catastro: solo URL, fetch y copy.
 */
import { etiquetaMotivoUnknownUi } from "./unknown-reason";

export const FILTRO_DIVISION_POR_DEFECTO = "NO" as const;

export const FILTROS_DIVISION = [
  { value: "NO", label: "Candidatas (sin DH)" },
  { value: "YES", label: "Con pisos (con DH)" },
  { value: "UNKNOWN", label: "Sin clasificar" },
  { value: "NOT_APPLICABLE", label: "No aplica" },
  { value: "ALL", label: "Todas las fincas" },
] as const;

export const FILTROS_DIVISION_FORM = [
  {
    value: "NO",
    label: "Candidatas (sin DH)",
    ayuda: "Solo parcelas o edificios que Catastro no tiene partidos en pisos. Es lo habitual para reforma.",
  },
  {
    value: "ALL",
    label: "Todas las fincas",
    ayuda: "Muestra los cuatro estados a la vez. No es un estado: es un filtro.",
  },
  {
    value: "YES",
    label: "Solo con DH",
    ayuda: "Solo fincas que Catastro ya tiene partidas en pisos o locales.",
  },
] as const;

export const AYUDA_FILTRO_DIVISION =
  "Por defecto solo ves parcelas o edificios que Catastro no tiene partidos en pisos. Es lo habitual para reforma. Si la lista sale vacía, elige «Todas las fincas».";

/**
 * Leyenda de los 4 estados de división horizontal.
 * «Todas las fincas» no entra: es un filtro, no una clasificación.
 */
export const LEYENDA_ESTADOS_DIVISION = [
  {
    status: "NO",
    etiqueta: "Candidata",
    filtro: "Candidata (sin DH)",
    texto:
      "Catastro dice que el edificio está construido y no está partido en pisos. Es la finca típica para reforma integral, por eso sale por defecto.",
  },
  {
    status: "YES",
    etiqueta: "Con pisos",
    filtro: "Con pisos (con DH)",
    texto:
      "Catastro dice que ya hay división horizontal (pisos o locales). No es candidata de reforma de finca entera.",
  },
  {
    status: "NOT_APPLICABLE",
    etiqueta: "No aplica",
    filtro: "No aplica",
    texto:
      "Suelo sin edificar u obras de urbanización. Aquí no tiene sentido preguntar si hay DH, así que no se clasifica como con/sin.",
  },
  {
    status: "UNKNOWN",
    etiqueta: "Sin clasificar",
    filtro: "Sin clasificar",
    texto:
      "Catastro no aclara si está dividida. No se trata como candidata: puede ser parcela urbano-rústica, faltar el dato o haber fallado la consulta.",
  },
] as const;

export const TITULO_LEYENDA_DIVISION = "Qué significa cada estado";

export const LEYENDA_FILTRO_TODAS =
  "La clasificación la da Catastro, no se marca a mano. «Todas las fincas» las muestra a la vez; no es un estado.";

export const TEXTO_ATAJOS_LISTA = "↑ y ↓ cambian de finca · Intro abre la ficha · Esc cierra";

export function clasePuntoDivision(status: string | undefined): string {
  if (status === "NO") return "bg-[#0B7461]";
  if (status === "YES") return "bg-[#B3ADA3]";
  if (status === "NOT_APPLICABLE") return "bg-[#8579C4]";
  return "bg-[#C79A22]";
}

export function claseTextoDivision(status: string | undefined): string {
  if (status === "NO") return "text-[#0B7461]";
  if (status === "YES") return "text-[#5D6B67]";
  if (status === "NOT_APPLICABLE") return "text-[#4B3F8A]";
  return "text-[#7A5A10]";
}

export function claseBadgeDivision(status: string | undefined): string {
  if (status === "NO") return "border-[#0B7461]/20 bg-[#E8F3EF] text-[#0B7461]";
  if (status === "YES") return "border-[#B3ADA3]/40 bg-[#F4F3EF] text-[#5D6B67]";
  if (status === "NOT_APPLICABLE") return "border-[#8579C4]/30 bg-[#F1EFF8] text-[#4B3F8A]";
  return "border-[#C79A22]/30 bg-[#FBF0D8] text-[#7A5A10]";
}

export function ayudaFiltroDivision(value: string): string {
  return FILTROS_DIVISION_FORM.find((item) => item.value === value)?.ayuda ?? AYUDA_FILTRO_DIVISION;
}

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

function metrosEs(valor: number): string {
  return Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Catastro manda literales larguísimos («Obras de urbanización y jardinería…»).
 * En la lista solo cabe una línea; el modal sigue mostrando el texto oficial.
 */
export function etiquetaUsoLista(uso: string): string {
  const n = uso
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/obras de urbanizacion/.test(n) || /urbanizacion y jardineria/.test(n)) return "Urbanización";
  if (/suelo(?:s)? sin edificar/.test(n)) return "Suelo";
  return uso;
}

export function metricasFincaLista(finca: FincaBusquedaUi): {
  parcela: string;
  inmuebles: string;
  anio: string;
  uso: string;
} {
  const usos = [...new Set((finca.properties ?? []).map((item) => item.uso?.trim()).filter(Boolean))];
  const anios = [...new Set((finca.properties ?? []).map((item) => item.anio).filter((item): item is number => item != null))];
  const sinUso = usos.length === 0;
  return {
    parcela: finca.superficieSolar != null ? `${metrosEs(finca.superficieSolar)} m²` : "—",
    inmuebles: String(finca.properties?.length ?? 0),
    anio: anios.length === 1 ? String(anios[0]) : anios.length > 1 ? "Varios" : "—",
    uso:
      usos.length === 1
        ? etiquetaUsoLista(usos[0] ?? "—")
        : usos.length > 1
          ? "Varios"
          : finca.horizontalDivision?.status === "NOT_APPLICABLE" && sinUso
            ? "Suelo"
            : "—",
  };
}

/** Línea de la tarjeta móvil: «3.617 m² de parcela · 0 inmuebles · — · Suelo». */
export function resumenTarjetaMovil(finca: FincaBusquedaUi): string {
  const metricas = metricasFincaLista(finca);
  const inmuebles = metricas.inmuebles === "1" ? "1 inmueble" : `${metricas.inmuebles} inmuebles`;
  return `${metricas.parcela} de parcela · ${inmuebles} · ${metricas.anio} · ${metricas.uso}`;
}

export function recuentoEstadosDivision(fincas: FincaBusquedaUi[]): Record<string, number> {
  const recuento: Record<string, number> = {
    ALL: fincas.length,
    NO: 0,
    YES: 0,
    UNKNOWN: 0,
    NOT_APPLICABLE: 0,
  };
  for (const finca of fincas) {
    const status = finca.horizontalDivision?.status ?? "UNKNOWN";
    recuento[status] = (recuento[status] ?? 0) + 1;
  }
  return recuento;
}

export function filtrarListaFincas(
  fincas: FincaBusquedaUi[],
  input: { q?: string; status?: string }
): FincaBusquedaUi[] {
  const q = input.q?.trim().toLowerCase() ?? "";
  const status = input.status?.trim().toUpperCase() || "ALL";
  return fincas.filter((finca) => {
    if (status !== "ALL" && (finca.horizontalDivision?.status ?? "UNKNOWN") !== status) return false;
    if (!q) return true;
    const haystack = [
      tituloDireccionFinca(finca),
      finca.fincaReference,
      ...(finca.properties ?? []).map((item) => item.reference),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
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

