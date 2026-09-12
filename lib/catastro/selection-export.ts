/**
 * Selección de fincas y exportación local (CSV) para /buscar.
 *
 * Todo ocurre en el navegador con los datos ya presentes en `Finca`.
 * No consulta Catastro, no llama al backend, no calcula datos comerciales.
 */
import {
  codigosPostalesVisibles,
  etiquetaEstadoDivision,
  numeroSecundarioOficial,
  type CriteriosBusquedaUi,
  type FincaBusquedaUi,
} from "./search-ui";
import {
  REVISION_VACIA,
  etiquetaEstadoComercial,
  type RevisionFincas,
} from "./revision-comercial";
import { etiquetaMotivoUnknownCsv } from "./unknown-reason";

// ---------------------------------------------------------------------------
// Selección
// ---------------------------------------------------------------------------

export type SeleccionFincas = {
  /** Búsqueda a la que pertenece la selección (`claveCriterios`). */
  claveBusqueda: string | null;
  /** Orden de selección; una finca solo puede aparecer una vez. */
  fincas: FincaBusquedaUi[];
};

export const SELECCION_VACIA: SeleccionFincas = { claveBusqueda: null, fincas: [] };

export function estaSeleccionada(seleccion: SeleccionFincas, fincaReference: string): boolean {
  return seleccion.fincas.some((finca) => finca.fincaReference === fincaReference);
}

/**
 * Añade o quita una finca. Si la selección era de otra búsqueda, se descarta primero:
 * nunca se mezclan candidatos de dos búsquedas.
 */
export function alternarSeleccion(
  seleccion: SeleccionFincas,
  finca: FincaBusquedaUi,
  claveBusqueda: string
): SeleccionFincas {
  const base = seleccionParaBusqueda(seleccion, claveBusqueda);
  if (estaSeleccionada(base, finca.fincaReference)) {
    return {
      claveBusqueda,
      fincas: base.fincas.filter((item) => item.fincaReference !== finca.fincaReference),
    };
  }
  return { claveBusqueda, fincas: [...base.fincas, finca] };
}

/** Devuelve la selección si pertenece a esa búsqueda; si no, una vacía para ella. */
export function seleccionParaBusqueda(
  seleccion: SeleccionFincas,
  claveBusqueda: string
): SeleccionFincas {
  if (seleccion.claveBusqueda === claveBusqueda) return seleccion;
  return { claveBusqueda, fincas: [] };
}

export function limpiarSeleccion(): SeleccionFincas {
  return SELECCION_VACIA;
}

export function textoSeleccion(total: number): string {
  return total === 1 ? "1 finca seleccionada" : `${total} fincas seleccionadas`;
}

// ---------------------------------------------------------------------------
// Datos oficiales derivados de una finca (sin peticiones)
// ---------------------------------------------------------------------------

export type InmuebleUi = NonNullable<FincaBusquedaUi["properties"]>[number];

export function numeroOficial(finca: FincaBusquedaUi): string {
  if (finca.address.numero) return finca.address.numero;
  return finca.portals.length === 1 ? finca.portals[0] : "";
}

/**
 * Dirección con campos oficiales: `sigla via numero numero2`.
 * Si no hay ninguno, el literal oficial (`ldt`). Nunca se inventa formato.
 */
export function direccionOficial(finca: FincaBusquedaUi): string {
  const numero = numeroOficial(finca);
  const partes = [
    finca.address.sigla?.trim(),
    finca.address.via?.trim(),
    numero ? `${numero}${numeroSecundarioOficial(finca)}` : "",
  ].filter((parte): parte is string => Boolean(parte));
  if (partes.length > 0) return partes.join(" ");
  return finca.address.literal?.trim() ?? "";
}

export function codigoPostalPrincipal(finca: FincaBusquedaUi): string {
  return finca.postalCode ?? codigosPostalesVisibles(finca)[0] ?? "";
}

export type DatoDetalle = { label: string; value: string };

export type DetalleFinca = {
  general: DatoDetalle[];
  inmuebles: Array<{ reference: string; datos: DatoDetalle[] }>;
};

function dato(label: string, value: string | number | null | undefined, sufijo = ""): DatoDetalle | null {
  if (value == null || value === "") return null;
  return { label, value: `${value}${sufijo}` };
}

function compactar(datos: Array<DatoDetalle | null>): DatoDetalle[] {
  return datos.filter((item): item is DatoDetalle => item !== null);
}

/** Todo lo que se puede mostrar de una finca con lo que ya trae la respuesta. */
export function detalleFinca(
  finca: FincaBusquedaUi,
  revision: RevisionFincas = REVISION_VACIA
): DetalleFinca {
  const cps = codigosPostalesVisibles(finca);
  const portales = finca.portals.filter(Boolean);
  const inmuebles = finca.properties ?? [];
  const unknown = finca.horizontalDivision?.status === "UNKNOWN";
  return {
    general: compactar([
      dato("Referencia finca", finca.fincaReference),
      dato("Provincia", finca.address.provincia),
      dato("Municipio", finca.address.municipio),
      dato("Dirección", direccionOficial(finca)),
      dato("Literal oficial", finca.address.literal),
      dato(cps.length === 1 ? "Código postal" : "Códigos postales", cps.join(", ")),
      dato("Superficie solar", finca.superficieSolar, " m²"),
      dato("División horizontal", etiquetaEstadoDivision(finca.horizontalDivision?.status)),
      dato(
        "Motivo",
        unknown ? etiquetaMotivoUnknownCsv(finca.horizontalDivision?.reasonCode) : null
      ),
      dato("Estado comercial", unknown ? etiquetaEstadoComercial(finca, revision) : null),
      dato(portales.length === 1 ? "Portal" : "Portales", portales.join(", ")),
      dato("Número de inmuebles", inmuebles.length > 0 ? inmuebles.length : null),
    ]),
    inmuebles: inmuebles.map((inmueble) => ({
      reference: inmueble.reference,
      datos: compactar([
        dato("Superficie", inmueble.superficie, " m²"),
        dato("Año", inmueble.anio),
        dato("Uso", inmueble.uso),
        dato("Bloque", inmueble.bloque),
        dato("Escalera", inmueble.escalera),
        dato("Planta", inmueble.planta),
        dato("Puerta", inmueble.puerta),
        dato("Código postal", inmueble.postalCode),
      ]),
    })),
  };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export const CSV_SEPARADOR = ";";
export const CSV_BOM = "\uFEFF";
export const CSV_FIN_LINEA = "\r\n";
/** Separador interno para listas dentro de una celda (referencias, portales, CP). */
export const CSV_SEPARADOR_LISTA = " | ";

export const COLUMNAS_CSV = [
  "Referencia finca",
  "Provincia",
  "Municipio",
  "Tipo vía",
  "Vía",
  "Número",
  "Número secundario",
  "Literal",
  "Código postal",
  "Códigos postales",
  "Superficie solar",
  "División horizontal",
  "Motivo",
  "Estado comercial",
  "Portales",
  "Número de inmuebles",
  "Referencias de inmuebles",
  "Datos inmuebles",
] as const;

export type ColumnaCsv = (typeof COLUMNAS_CSV)[number];

export function escaparCsv(valor: string, separador: string = CSV_SEPARADOR): string {
  const necesitaComillas =
    valor.includes(separador) ||
    valor.includes('"') ||
    valor.includes("\n") ||
    valor.includes("\r");
  if (!necesitaComillas) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

/** Número con coma decimal (Excel en español). */
export function formatearNumeroCsv(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  return String(valor).replace(".", ",");
}

export function generarCsv(
  cabecera: readonly string[],
  filas: ReadonlyArray<readonly string[]>,
  separador: string = CSV_SEPARADOR
): string {
  const lineas = [cabecera, ...filas].map((fila) =>
    fila.map((celda) => escaparCsv(celda, separador)).join(separador)
  );
  return `${CSV_BOM}${lineas.join(CSV_FIN_LINEA)}${CSV_FIN_LINEA}`;
}

function resumenInmueble(inmueble: InmuebleUi): string {
  const partes = [
    inmueble.reference,
    inmueble.superficie != null ? `${formatearNumeroCsv(inmueble.superficie)} m²` : null,
    inmueble.anio != null ? `Año ${inmueble.anio}` : null,
    inmueble.uso || null,
    inmueble.bloque ? `Bl ${inmueble.bloque}` : null,
    inmueble.escalera ? `Es ${inmueble.escalera}` : null,
    inmueble.planta ? `Pl ${inmueble.planta}` : null,
    inmueble.puerta ? `Pt ${inmueble.puerta}` : null,
    inmueble.postalCode ? `CP ${inmueble.postalCode}` : null,
  ].filter((parte): parte is string => Boolean(parte));
  return partes.join(" · ");
}

export function filaCsvDesdeFinca(
  finca: FincaBusquedaUi,
  revision: RevisionFincas = REVISION_VACIA
): Record<ColumnaCsv, string> {
  const inmuebles = finca.properties ?? [];
  const cps = codigosPostalesVisibles(finca);
  return {
    "Referencia finca": finca.fincaReference,
    Provincia: finca.address.provincia ?? "",
    Municipio: finca.address.municipio ?? "",
    "Tipo vía": finca.address.sigla ?? "",
    Vía: finca.address.via ?? "",
    Número: numeroOficial(finca),
    "Número secundario": numeroSecundarioOficial(finca),
    Literal: finca.address.literal ?? "",
    "Código postal": codigoPostalPrincipal(finca),
    "Códigos postales": cps.join(CSV_SEPARADOR_LISTA),
    "Superficie solar": formatearNumeroCsv(finca.superficieSolar),
    "División horizontal": etiquetaEstadoDivision(finca.horizontalDivision?.status),
    Motivo:
      finca.horizontalDivision?.status === "UNKNOWN"
        ? etiquetaMotivoUnknownCsv(finca.horizontalDivision.reasonCode)
        : "",
    "Estado comercial": etiquetaEstadoComercial(finca, revision),
    Portales: finca.portals.filter(Boolean).join(CSV_SEPARADOR_LISTA),
    "Número de inmuebles": inmuebles.length > 0 ? String(inmuebles.length) : "",
    "Referencias de inmuebles": inmuebles.map((item) => item.reference).join(CSV_SEPARADOR_LISTA),
    "Datos inmuebles": inmuebles.map(resumenInmueble).join(CSV_SEPARADOR_LISTA),
  };
}

export function csvDesdeFincas(
  fincas: FincaBusquedaUi[],
  revision: RevisionFincas = REVISION_VACIA
): string {
  const filas = fincas.map((finca) => {
    const fila = filaCsvDesdeFinca(finca, revision);
    return COLUMNAS_CSV.map((columna) => fila[columna]);
  });
  return generarCsv(COLUMNAS_CSV, filas);
}

// ---------------------------------------------------------------------------
// Nombre de archivo
// ---------------------------------------------------------------------------

function capitalizarPalabras(valor: string): string {
  return valor
    .toLowerCase()
    .replace(/(^|[\s\-_.'])([\p{L}\p{N}])/gu, (_match, sep: string, letra: string) => `${sep}${letra.toUpperCase()}`);
}

/** Quita lo que no puede ir en un nombre de archivo y compacta a `_`. */
export function sanitizarNombreArchivo(valor: string): string {
  return valor
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/[\s.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function prefijoArchivo(horizontalDivision: string): string {
  const filtro = horizontalDivision.trim().toUpperCase();
  if (filtro === "NO") return "fincas_sin_division_horizontal";
  if (filtro === "YES") return "fincas_con_division_horizontal";
  if (filtro === "UNKNOWN") return "fincas_division_no_determinada";
  if (filtro === "NOT_APPLICABLE") return "fincas_division_no_aplica";
  if (filtro === "REVIEW") return "fincas_para_revisar";
  return "fincas";
}

export function fechaArchivo(fecha: Date): string {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type CriteriosNombreArchivo = Pick<
  CriteriosBusquedaUi,
  "municipio" | "via" | "numero" | "horizontalDivision"
> & {
  /** Búsqueda por zona: sin vía, el CP identifica el archivo (`..._Godelleta_CP46388_...`). */
  postalCode?: string;
};

export function nombreArchivoExportacion(
  criterios: CriteriosNombreArchivo,
  fecha: Date = new Date(),
  extension = "csv"
): string {
  const via = criterios.via.trim();
  const postalCode = criterios.postalCode?.trim() ?? "";
  const partes = [
    prefijoArchivo(criterios.horizontalDivision),
    capitalizarPalabras(sanitizarNombreArchivo(criterios.municipio.trim())),
    via ? capitalizarPalabras(sanitizarNombreArchivo(via)) : postalCode ? `CP${sanitizarNombreArchivo(postalCode)}` : "",
    sanitizarNombreArchivo(criterios.numero.trim()),
    fechaArchivo(fecha),
  ].filter(Boolean);
  return `${partes.join("_")}.${extension}`;
}

// ---------------------------------------------------------------------------
// Completitud y preparación de la exportación
// ---------------------------------------------------------------------------

export const AVISO_EXPORTACION_INCOMPLETA =
  "La búsqueda todavía no está completa. La exportación contiene únicamente los candidatos revisados hasta ahora.";

export const AVISO_EXPORTACION_CORTE =
  "Catastro indica que esta zona puede contener más resultados de los recuperados. La exportación puede estar incompleta.";

export type CoberturaExportacion = {
  completeCandidates: boolean;
  possibleCut: boolean;
};

/**
 * Cobertura efectiva de lo que el usuario ha visto: la última página cargada manda,
 * y basta una página con `possibleCut` para avisar.
 */
export function coberturaExportacion(
  paginas: ReadonlyArray<{
    coverage: { completeCandidates: boolean; possibleCut: boolean };
    pagination: { hasNextPage: boolean };
  }>
): CoberturaExportacion {
  const ultima = paginas[paginas.length - 1];
  if (!ultima) return { completeCandidates: false, possibleCut: false };
  return {
    completeCandidates: ultima.coverage.completeCandidates && !ultima.pagination.hasNextPage,
    possibleCut: paginas.some((pagina) => pagina.coverage.possibleCut),
  };
}

export function advertenciaExportacion(cobertura: CoberturaExportacion): string | null {
  if (cobertura.possibleCut) return AVISO_EXPORTACION_CORTE;
  if (!cobertura.completeCandidates) return AVISO_EXPORTACION_INCOMPLETA;
  return null;
}

export type ExportacionPreparada =
  | {
      ok: true;
      nombreArchivo: string;
      contenido: string;
      mimeType: string;
      totalFincas: number;
      advertencia: string | null;
    }
  | { ok: false; motivo: string };

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

export function prepararExportacionCsv(input: {
  seleccion: SeleccionFincas;
  criterios: CriteriosNombreArchivo;
  cobertura: CoberturaExportacion;
  fecha?: Date;
  revision?: RevisionFincas;
}): ExportacionPreparada {
  if (input.seleccion.fincas.length === 0) {
    return { ok: false, motivo: "No hay fincas seleccionadas para exportar." };
  }
  const revision = input.revision ?? REVISION_VACIA;
  return {
    ok: true,
    nombreArchivo: nombreArchivoExportacion(input.criterios, input.fecha ?? new Date()),
    contenido: csvDesdeFincas(input.seleccion.fincas, revision),
    mimeType: CSV_MIME_TYPE,
    totalFincas: input.seleccion.fincas.length,
    advertencia: advertenciaExportacion(input.cobertura),
  };
}

/** CSV exclusivo de fincas REVIEW. Reutiliza `csvDesdeFincas`. */
export function prepararExportacionRevisionCsv(input: {
  revision: RevisionFincas;
  criterios: CriteriosNombreArchivo;
  cobertura: CoberturaExportacion;
  fecha?: Date;
}): ExportacionPreparada {
  if (input.revision.fincas.length === 0) {
    return { ok: false, motivo: "No hay fincas marcadas para revisar." };
  }
  return {
    ok: true,
    nombreArchivo: nombreArchivoExportacion(
      { ...input.criterios, horizontalDivision: "REVIEW" },
      input.fecha ?? new Date()
    ),
    contenido: csvDesdeFincas(input.revision.fincas, input.revision),
    mimeType: CSV_MIME_TYPE,
    totalFincas: input.revision.fincas.length,
    advertencia: advertenciaExportacion(input.cobertura),
  };
}

// ---------------------------------------------------------------------------
// Portapapeles y descarga (navegador; inyectables para tests)
// ---------------------------------------------------------------------------

export type EscritorPortapapeles = (texto: string) => Promise<void>;

function escritorPorDefecto(): EscritorPortapapeles | null {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return null;
  return (texto) => navigator.clipboard.writeText(texto);
}

export async function copiarAlPortapapeles(
  texto: string,
  escribir: EscritorPortapapeles | null = escritorPorDefecto()
): Promise<boolean> {
  if (!texto || !escribir) return false;
  try {
    await escribir(texto);
    return true;
  } catch {
    return false;
  }
}

export function descargarArchivoLocal(
  nombreArchivo: string,
  contenido: string,
  mimeType: string,
  documento: Document | null = typeof document === "undefined" ? null : document
): boolean {
  if (!documento || typeof URL === "undefined" || typeof Blob === "undefined") return false;
  const blob = new Blob([contenido], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const enlace = documento.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.rel = "noopener";
  documento.body.appendChild(enlace);
  enlace.click();
  documento.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
