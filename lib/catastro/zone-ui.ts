/**
 * Lógica de interfaz de la búsqueda por zona (código postal), sin React.
 * El componente solo pinta lo que estas funciones deciden; así se prueba con node:test.
 * El navegador habla únicamente con `/api/catastro/zone/*`.
 */
import { ZONE_MAX_STREETS_RUN } from "./constants";
import type { CoberturaExportacion, CriteriosNombreArchivo } from "./selection-export";
import { ErrorBusquedaUi, mensajeErrorBusqueda, type FincaBusquedaUi } from "./search-ui";

// ---------------------------------------------------------------------------
// Modo de búsqueda
// ---------------------------------------------------------------------------

export type ModoBusqueda = "calle" | "zona";

export const MODOS_BUSQUEDA = [
  {
    value: "calle",
    label: "Una calle",
    descripcion: "Provincia y municipio. Si no pones calle, se recorre el pueblo por bloques.",
  },
  {
    value: "zona",
    label: "Un código postal",
    descripcion: "Recorre las calles por bloques y se queda con las fincas de ese CP.",
  },
] as const satisfies ReadonlyArray<{
  value: ModoBusqueda;
  label: string;
  descripcion: string;
}>;

export const EXPLICACION_ZONA =
  "Catastro no permite buscar directamente por código postal. Pedimos las calles oficiales de ese CP y las recorremos. Las fincas de ese código postal serán todos los resultados.";

export const EXPLICACION_MUNICIPIO =
  "Sin calle se recorren las calles oficiales del municipio por bloques. En un pueblo cabe en uno; en A Coruña o Madrid puedes seguir bloque a bloque. Puedes parar cuando quieras.";

export function modoDesdeTexto(raw: string | null | undefined): ModoBusqueda {
  return raw?.trim().toLowerCase() === "zona" ? "zona" : "calle";
}

export function camposVisibles(modo: ModoBusqueda): {
  calle: boolean;
  numero: boolean;
  postalCode: boolean;
  division: boolean;
} {
  return {
    calle: modo === "calle",
    numero: modo === "calle",
    postalCode: true,
    division: true,
  };
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------

export type CriteriosZonaUi = {
  provincia: string;
  municipio: string;
  postalCode: string;
  horizontalDivision: string;
  streetOffset?: number;
};

export function validarCodigoPostalZona(valor: string): string | null {
  const limpio = valor.replace(/\s+/g, "");
  if (!limpio) return "Indica el código postal.";
  if (!/^\d{5}$/.test(limpio)) return "El código postal debe tener 5 dígitos.";
  return null;
}

export function criteriosZonaListos(input: {
  provincia: string | null | undefined;
  municipio: string | null | undefined;
  postalCode: string;
  horizontalDivision: string;
}): CriteriosZonaUi | null {
  const provincia = input.provincia?.trim() ?? "";
  const municipio = input.municipio?.trim() ?? "";
  const postalCode = input.postalCode.replace(/\s+/g, "");
  if (!provincia || !municipio || validarCodigoPostalZona(postalCode)) return null;
  return {
    provincia,
    municipio,
    postalCode,
    horizontalDivision: input.horizontalDivision.trim().toUpperCase() || "NO",
  };
}

/** Provincia + municipio. El CP, si se indica, tiene que ser de 5 dígitos. */
export function criteriosMunicipioListos(input: {
  provincia: string | null | undefined;
  municipio: string | null | undefined;
  postalCode: string;
  horizontalDivision: string;
}): CriteriosZonaUi | null {
  const provincia = input.provincia?.trim() ?? "";
  const municipio = input.municipio?.trim() ?? "";
  const postalCode = input.postalCode.replace(/\s+/g, "");
  if (!provincia || !municipio) return null;
  if (postalCode && !/^\d{5}$/.test(postalCode)) return null;
  return {
    provincia,
    municipio,
    postalCode,
    horizontalDivision: input.horizontalDivision.trim().toUpperCase() || "NO",
  };
}

/** Clave de selección: cambiar CP, municipio o filtro vacía la selección (como en calle). */
export function claveZonaUi(criterios: CriteriosZonaUi): string {
  return [criterios.provincia, criterios.municipio, criterios.postalCode, criterios.horizontalDivision]
    .map((valor) => valor.trim().toUpperCase())
    .join("|");
}

// ---------------------------------------------------------------------------
// Estado de la búsqueda
// ---------------------------------------------------------------------------

export type ZoneStatusUi =
  | "prepared"
  | "running"
  | "paused"
  | "cancelled"
  | "upstream_paused"
  | "done";

export type ZoneSnapshotUi = {
  ok: true;
  zoneSearchId: string;
  status: ZoneStatusUi;
  criteria: {
    provincia: string;
    municipio: string;
    postalCode: string;
    horizontalDivision: string;
    streetOffset?: number;
  };
  progress: {
    streetsFound: number;
    streetsProcessed: number;
    streetsWithErrors: number;
    streetsPending: number;
    streetsInProgress: number;
    fincasFound: number;
    candidates: number;
    portalsProcessed: number;
    steps: number;
    workMs: number;
  };
  coverage: {
    streetsFound: number;
    streetsProcessed: number;
    streetsWithErrors: number;
    complete: boolean;
    completeCandidates: boolean;
    possibleCut: boolean;
    streetsTotal?: number;
    streetOffset?: number;
    hasNextBlock?: boolean;
  };
  results: FincaBusquedaUi[];
  errors: Array<{ street: string; error: string }>;
  nextAction: "start" | "step" | "resume" | "none";
  reused?: boolean;
};

export type FaseZona =
  | "formulario"
  | "preparando"
  | "preparada"
  | "ejecutando"
  | "cancelada"
  | "pausada_por_catastro"
  | "completada"
  | "caducada"
  | "error";

export type AcumuladoZona = {
  results: FincaBusquedaUi[];
  errors: Array<{ street: string; error: string }>;
  streetsProcessed: number;
  streetsWithErrors: number;
  fincasFound: number;
  candidates: number;
  portalsProcessed: number;
};

export type EstadoZonaUi = {
  fase: FaseZona;
  zoneSearchId: string | null;
  snapshot: ZoneSnapshotUi | null;
  error: string | null;
  /** Instante en que el usuario pulsó Comenzar (o Reanudar); para el ritmo medido. */
  inicioMs: number | null;
  /** Calles ya procesadas al arrancar el tramo actual. */
  procesadasAlInicio: number;
  /** Bloques anteriores de la misma búsqueda (el snapshot solo tiene el actual). */
  acumulado: AcumuladoZona | null;
};

export const ESTADO_ZONA_INICIAL: EstadoZonaUi = {
  fase: "formulario",
  zoneSearchId: null,
  snapshot: null,
  error: null,
  inicioMs: null,
  procesadasAlInicio: 0,
  acumulado: null,
};

export function fusionarResultadosZona(
  previas: FincaBusquedaUi[],
  nuevas: FincaBusquedaUi[]
): FincaBusquedaUi[] {
  const porRef = new Map(previas.map((finca) => [finca.fincaReference, finca] as const));
  for (const finca of nuevas) {
    const previa = porRef.get(finca.fincaReference);
    if (!previa) {
      porRef.set(finca.fincaReference, finca);
      continue;
    }
    const portals = [...new Set([...(previa.portals ?? []), ...(finca.portals ?? [])])];
    const postalCodes = [
      ...new Set(
        [...(previa.postalCodes ?? []), ...(finca.postalCodes ?? []), previa.postalCode, finca.postalCode].filter(
          (item): item is string => Boolean(item)
        )
      ),
    ];
    porRef.set(finca.fincaReference, {
      ...previa,
      ...finca,
      portals,
      postalCodes,
      postalCode: postalCodes[0] ?? finca.postalCode ?? previa.postalCode,
    });
  }
  return [...porRef.values()];
}

export function plegarBloque(estado: EstadoZonaUi): EstadoZonaUi {
  const snapshot = estado.snapshot;
  if (!snapshot) return estado;
  const previa = estado.acumulado;
  return {
    ...estado,
    acumulado: {
      results: fusionarResultadosZona(previa?.results ?? [], snapshot.results),
      errors: [...(previa?.errors ?? []), ...snapshot.errors],
      streetsProcessed: (previa?.streetsProcessed ?? 0) + snapshot.progress.streetsProcessed,
      streetsWithErrors: (previa?.streetsWithErrors ?? 0) + snapshot.progress.streetsWithErrors,
      fincasFound: (previa?.fincasFound ?? 0) + snapshot.progress.fincasFound,
      candidates: fusionarResultadosZona(previa?.results ?? [], snapshot.results).length,
      portalsProcessed: (previa?.portalsProcessed ?? 0) + snapshot.progress.portalsProcessed,
    },
  };
}

export function resultadosVisiblesZona(estado: EstadoZonaUi): FincaBusquedaUi[] {
  return fusionarResultadosZona(estado.acumulado?.results ?? [], estado.snapshot?.results ?? []);
}

export function erroresVisiblesZona(estado: EstadoZonaUi): Array<{ street: string; error: string }> {
  return [...(estado.acumulado?.errors ?? []), ...(estado.snapshot?.errors ?? [])];
}

export function resumenBloque(coverage: ZoneSnapshotUi["coverage"], streetsFound: number): {
  total: number;
  offset: number;
  indice: number;
  bloques: number;
  desde: number;
  hasta: number;
  hasNext: boolean;
} {
  const total = coverage.streetsTotal && coverage.streetsTotal > 0 ? coverage.streetsTotal : streetsFound;
  const offset = coverage.streetOffset ?? 0;
  const bloques = Math.max(1, Math.ceil(total / ZONE_MAX_STREETS_RUN));
  const indice = Math.min(bloques, Math.floor(offset / ZONE_MAX_STREETS_RUN) + 1);
  return {
    total,
    offset,
    indice,
    bloques,
    desde: streetsFound === 0 ? 0 : offset + 1,
    hasta: offset + streetsFound,
    hasNext: Boolean(coverage.hasNextBlock) || offset + streetsFound < total,
  };
}

export function criteriosSiguienteBloque(
  criterios: CriteriosZonaUi,
  snapshot: ZoneSnapshotUi
): CriteriosZonaUi | null {
  const bloque = resumenBloque(snapshot.coverage, snapshot.progress.streetsFound);
  if (!bloque.hasNext) return null;
  return {
    ...criterios,
    streetOffset: bloque.offset + snapshot.progress.streetsFound,
  };
}

export function estadoAlCambiarModo(): EstadoZonaUi {
  return ESTADO_ZONA_INICIAL;
}

export function faseDesdeSnapshot(snapshot: ZoneSnapshotUi, ejecutando: boolean): FaseZona {
  if (snapshot.status === "done") return "completada";
  if (snapshot.status === "cancelled") return "cancelada";
  if (snapshot.status === "upstream_paused") return "pausada_por_catastro";
  if (snapshot.status === "running") return "ejecutando";
  // prepared / paused
  if (ejecutando) return "ejecutando";
  return snapshot.progress.steps === 0 ? "preparada" : "cancelada";
}

export function aplicarSnapshotZona(
  estado: EstadoZonaUi,
  snapshot: ZoneSnapshotUi,
  opciones: { ejecutando?: boolean } = {}
): EstadoZonaUi {
  return {
    ...estado,
    fase: faseDesdeSnapshot(snapshot, Boolean(opciones.ejecutando)),
    zoneSearchId: snapshot.zoneSearchId,
    snapshot,
    error: null,
  };
}

export function iniciarTramo(estado: EstadoZonaUi, ahoraMs: number): EstadoZonaUi {
  return {
    ...estado,
    fase: "ejecutando",
    error: null,
    inicioMs: ahoraMs,
    procesadasAlInicio: estado.snapshot?.progress.streetsProcessed ?? 0,
  };
}

export function aplicarErrorZona(
  estado: EstadoZonaUi,
  error: { status?: number; message: string }
): EstadoZonaUi {
  if (error.status === 410) {
    return {
      ...estado,
      fase: "caducada",
      error: textoSesionCaducada({
        streetsFound: estado.snapshot?.progress.streetsFound,
        streetsProcessed: estado.snapshot?.progress.streetsProcessed,
      }),
    };
  }
  return { ...estado, fase: "error", error: error.message };
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

function plural(n: number, singular: string, pluralTexto: string): string {
  return n === 1 ? singular : pluralTexto;
}

export function textoPreparacion(
  streetsFound: number,
  postalCode?: string,
  streetsTotal?: number
): string {
  if (streetsFound === 0 && !(streetsTotal && streetsTotal > 0)) {
    return "Catastro no devuelve calles oficiales para este municipio. No hay nada que recorrer.";
  }
  const total = streetsTotal && streetsTotal > 0 ? streetsTotal : streetsFound;
  if (streetsTotal != null && streetsTotal > ZONE_MAX_STREETS_RUN) {
    const bloques = Math.max(1, Math.ceil(total / ZONE_MAX_STREETS_RUN));
    const alcance = postalCode?.trim()
      ? `Si el código postal es ${postalCode.trim()}, esas fincas serán todos los resultados.`
      : "Se recorrerá el municipio por bloques.";
    return `Hay ${total.toLocaleString("es-ES")} calles oficiales. ${alcance} Este primer bloque tiene ${streetsFound} calles (${bloques} bloques en total).`;
  }
  const alcance = postalCode?.trim()
    ? "La búsqueda recorrerá esas calles y filtrará después por código postal."
    : "La búsqueda recorrerá todas esas calles del municipio.";
  return `Se ${plural(streetsFound, "ha encontrado", "han encontrado")} ${streetsFound} ${plural(
    streetsFound,
    "calle oficial",
    "calles oficiales"
  )} en este municipio. ${alcance}`;
}

export function textoCallesARevisar(streetsFound: number): string {
  return streetsFound === 1
    ? "Se revisará 1 calle. Puedes parar cuando quieras."
    : `Se revisarán ${streetsFound} calles. Puedes parar cuando quieras.`;
}

export function zonaDemasiadoGrande(streetsFound: number): boolean {
  return streetsFound > ZONE_MAX_STREETS_RUN;
}

export function textoZonaDemasiadoGrande(streetsFound: number, municipio: string): string {
  const nombre = municipio.trim() || "Este municipio";
  return `${nombre} tiene ${streetsFound.toLocaleString("es-ES")} calles oficiales. Se buscará por bloques de ${ZONE_MAX_STREETS_RUN} calles para que no se pierda la sesión. Luego puedes seguir con el siguiente bloque.`;
}

export function textoSiguienteBloque(snapshot: ZoneSnapshotUi): string {
  const bloque = resumenBloque(snapshot.coverage, snapshot.progress.streetsFound);
  const siguienteDesde = bloque.hasta + 1;
  const siguienteHasta = Math.min(bloque.hasta + ZONE_MAX_STREETS_RUN, bloque.total);
  return `Siguiente bloque (calles ${siguienteDesde.toLocaleString("es-ES")}–${siguienteHasta.toLocaleString("es-ES")} de ${bloque.total.toLocaleString("es-ES")})`;
}

export function textoSesionCaducada(input: {
  streetsFound?: number;
  streetsProcessed?: number;
}): string {
  const encontradas = input.streetsFound ?? 0;
  const procesadas = input.streetsProcessed ?? 0;
  if (procesadas === 0 && zonaDemasiadoGrande(encontradas)) {
    return "La sesión se ha perdido en el servidor. Prepara de nuevo este bloque y, si puedes, no cambies de pestaña.";
  }
  if (procesadas === 0) {
    return "La sesión se ha perdido en el servidor antes de recorrer ninguna calle. Pulsa Continuar y Empezar ahora sin cambiar de pestaña.";
  }
  return "La búsqueda por zona ha caducado en el servidor. Los resultados ya obtenidos siguen disponibles; prepárala de nuevo para continuar.";
}

export function etiquetaCandidatas(horizontalDivision: string): string {
  const filtro = horizontalDivision.trim().toUpperCase();
  if (filtro === "NO") return "Candidatas sin división horizontal";
  if (filtro === "YES") return "Fincas con división horizontal";
  if (filtro === "UNKNOWN") return "Fincas con división no determinada";
  if (filtro === "NOT_APPLICABLE") return "Fincas no aplicables";
  return "Fincas con el código postal";
}

export function textosProgreso(
  snapshot: ZoneSnapshotUi,
  acumulado?: AcumuladoZona | null
): {
  calles: string;
  fincas: string;
  candidatas: string;
  errores: string | null;
  porcentaje: number;
} {
  const { progress } = snapshot;
  const bloque = resumenBloque(snapshot.coverage, progress.streetsFound);
  const procesadas = (acumulado?.streetsProcessed ?? 0) + progress.streetsProcessed;
  const fincas = (acumulado?.fincasFound ?? 0) + progress.fincasFound;
  const candidatas = acumulado
    ? fusionarResultadosZona(acumulado.results, snapshot.results).length
    : progress.candidates;
  const erroresN = (acumulado?.streetsWithErrors ?? 0) + progress.streetsWithErrors;
  const porBloques =
    bloque.hasNext || bloque.offset > 0 || bloque.total > progress.streetsFound;
  const porcentaje =
    bloque.total === 0 ? 100 : Math.floor((procesadas / bloque.total) * 100);
  const calles = porBloques
    ? `Calles revisadas: ${procesadas} / ${bloque.total} · bloque ${bloque.indice} de ${bloque.bloques}`
    : `Calles revisadas: ${progress.streetsProcessed} / ${progress.streetsFound}`;
  return {
    calles,
    fincas: `Fincas encontradas: ${fincas}`,
    candidatas: `${etiquetaCandidatas(snapshot.criteria.horizontalDivision)}: ${candidatas || progress.candidates}`,
    errores: erroresN > 0 ? `Calles con errores: ${erroresN}` : null,
    porcentaje: Math.min(100, Math.max(0, porcentaje)),
  };
}

/**
 * Solo hechos medidos (calles/min y portales revisados) tras varias calles.
 * No estima tiempos: la duración depende de cuántos portales tenga cada calle.
 */
export function ritmoMedido(
  snapshot: ZoneSnapshotUi,
  estado: Pick<EstadoZonaUi, "inicioMs" | "procesadasAlInicio">,
  ahoraMs: number
): string | null {
  if (estado.inicioMs == null) return null;
  const transcurridoMs = ahoraMs - estado.inicioMs;
  const procesadas = snapshot.progress.streetsProcessed - estado.procesadasAlInicio;
  if (procesadas < 5 || transcurridoMs < 1_000) return null;
  const porMinuto = procesadas / (transcurridoMs / 60_000);
  const ritmo = porMinuto >= 10 ? Math.round(porMinuto) : Math.round(porMinuto * 10) / 10;
  return `Ritmo medido: ${ritmo} calles/min · ${snapshot.progress.portalsProcessed} portales revisados. La duración depende de los portales de cada calle.`;
}

export function textoEstadoFinal(estado: EstadoZonaUi): string | null {
  const snapshot = estado.snapshot;
  if (!snapshot) return null;
  const { progress, coverage } = snapshot;
  const procesadas = `${progress.streetsProcessed} / ${progress.streetsFound} calles procesadas`;
  switch (estado.fase) {
    case "cancelada":
      return `Búsqueda cancelada: ${procesadas}.`;
    case "pausada_por_catastro":
      return `Catastro no responde. Búsqueda pausada para no saturar el servicio: ${procesadas}.`;
    case "caducada":
      return `Búsqueda caducada en el servidor: ${procesadas}.`;
    case "completada":
      if (resumenBloque(coverage, progress.streetsFound).hasNext) {
        return `Bloque ${resumenBloque(coverage, progress.streetsFound).indice} de ${resumenBloque(coverage, progress.streetsFound).bloques} terminado. Puedes continuar con el siguiente.`;
      }
      if (coverage.completeCandidates) return "Búsqueda completa: todas las calles del municipio revisadas.";
      if (coverage.streetsWithErrors > 0) {
        return `Búsqueda terminada con ${coverage.streetsWithErrors} ${plural(
          coverage.streetsWithErrors,
          "calle con error",
          "calles con errores"
        )}. Puede faltar alguna finca.`;
      }
      if (coverage.possibleCut) {
        return "Búsqueda terminada. Catastro indica que alguna calle puede contener más portales de los recuperados.";
      }
      return "Búsqueda terminada. Alguna finca no se ha podido clasificar con certeza.";
    default:
      return null;
  }
}

export function listaErrores(
  errores: ZoneSnapshotUi["errors"],
  maximo = 5
): { lineas: string[]; resto: number } {
  const lineas = errores.slice(0, maximo).map((item) => `${item.street}: ${item.error}`);
  return { lineas, resto: Math.max(0, errores.length - lineas.length) };
}

// ---------------------------------------------------------------------------
// Acciones y bucle de pasos
// ---------------------------------------------------------------------------

export type AccionesZona = {
  preparar: boolean;
  comenzar: boolean;
  cancelar: boolean;
  reanudar: boolean;
  reintentarErrores: boolean;
  nuevaBusqueda: boolean;
  siguienteBloque: boolean;
};

const ACCIONES_CERRADAS: AccionesZona = {
  preparar: false,
  comenzar: false,
  cancelar: false,
  reanudar: false,
  reintentarErrores: false,
  nuevaBusqueda: false,
  siguienteBloque: false,
};

export function accionesDisponibles(estado: EstadoZonaUi): AccionesZona {
  const snapshot = estado.snapshot;
  const pendientes = (snapshot?.progress.streetsPending ?? 0) > 0;
  const conErrores = (snapshot?.progress.streetsWithErrors ?? 0) > 0;
  const haySiguiente = Boolean(snapshot && resumenBloque(snapshot.coverage, snapshot.progress.streetsFound).hasNext);
  switch (estado.fase) {
    case "formulario":
    case "error":
      return {
        ...ACCIONES_CERRADAS,
        preparar: true,
        reanudar: estado.fase === "error" && Boolean(snapshot) && pendientes,
        nuevaBusqueda: Boolean(snapshot),
      };
    case "preparando":
      return ACCIONES_CERRADAS;
    case "preparada":
      return {
        ...ACCIONES_CERRADAS,
        comenzar: (snapshot?.progress.streetsFound ?? 0) > 0,
        nuevaBusqueda: true,
      };
    case "ejecutando":
      return { ...ACCIONES_CERRADAS, cancelar: true };
    case "cancelada":
    case "pausada_por_catastro":
      return {
        ...ACCIONES_CERRADAS,
        reanudar: pendientes,
        reintentarErrores: !pendientes && conErrores,
        nuevaBusqueda: true,
      };
    case "completada":
      return {
        ...ACCIONES_CERRADAS,
        reintentarErrores: conErrores,
        nuevaBusqueda: true,
        siguienteBloque: haySiguiente,
      };
    case "caducada":
      return { ...ACCIONES_CERRADAS, preparar: true, nuevaBusqueda: true };
  }
}

/** Mientras el servidor diga `prepared`/`paused`/`running`, el cliente sigue pidiendo pasos. */
export function debeContinuarPasos(snapshot: ZoneSnapshotUi): boolean {
  return snapshot.status === "prepared" || snapshot.status === "paused" || snapshot.status === "running";
}

export type OpcionesBucleZona = {
  paso: (signal: AbortSignal) => Promise<ZoneSnapshotUi>;
  onSnapshot: (snapshot: ZoneSnapshotUi) => void;
  signal: AbortSignal;
  /** Espera entre reintentos por 409 (otro paso en curso). Inyectable en tests. */
  esperar?: (ms: number) => Promise<void>;
  maxReintentosOcupado?: number;
  maxPasos?: number;
};

function esperarReal(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Encadena pasos hasta que la zona termine, se cancele o el usuario aborte.
 * Cada snapshot se entrega en cuanto llega: los resultados aparecen de forma progresiva.
 */
export async function ejecutarBucleZona(opciones: OpcionesBucleZona): Promise<ZoneSnapshotUi | null> {
  const esperar = opciones.esperar ?? esperarReal;
  const maxReintentos = opciones.maxReintentosOcupado ?? 5;
  const maxPasos = opciones.maxPasos ?? 10_000;
  let ultimo: ZoneSnapshotUi | null = null;
  let ocupados = 0;

  for (let paso = 0; paso < maxPasos && !opciones.signal.aborted; paso += 1) {
    let snapshot: ZoneSnapshotUi;
    try {
      snapshot = await opciones.paso(opciones.signal);
    } catch (error) {
      if (opciones.signal.aborted) return ultimo;
      if (error instanceof ErrorBusquedaUi && error.status === 409 && ocupados < maxReintentos) {
        ocupados += 1;
        await esperar(1_000 * ocupados);
        continue;
      }
      throw error;
    }
    ocupados = 0;
    ultimo = snapshot;
    if (opciones.signal.aborted) return ultimo;
    opciones.onSnapshot(snapshot);
    if (!debeContinuarPasos(snapshot)) return snapshot;
  }
  return ultimo;
}

// ---------------------------------------------------------------------------
// Exportación (reutiliza selection-export)
// ---------------------------------------------------------------------------

export function coberturaExportacionZona(snapshot: ZoneSnapshotUi | null): CoberturaExportacion {
  if (!snapshot) return { completeCandidates: false, possibleCut: false };
  return {
    completeCandidates:
      snapshot.status === "done" &&
      snapshot.coverage.completeCandidates &&
      !snapshot.coverage.hasNextBlock,
    possibleCut: snapshot.coverage.possibleCut,
  };
}

export function criteriosExportacionZona(snapshot: ZoneSnapshotUi): CriteriosNombreArchivo {
  return {
    municipio: snapshot.criteria.municipio,
    via: "",
    numero: "",
    postalCode: snapshot.criteria.postalCode,
    horizontalDivision: snapshot.criteria.horizontalDivision,
  };
}

// ---------------------------------------------------------------------------
// Fetchers: el navegador solo habla con /api/catastro/zone/*
// ---------------------------------------------------------------------------

export const ZONE_STEP_CLIENT_BUDGET_MS = 15_000;

async function peticionZona(
  path: string,
  body: Record<string, string | number | boolean> | null,
  signal?: AbortSignal,
  method = "POST"
): Promise<ZoneSnapshotUi> {
  const response = await fetch(`/api/catastro/zone${path}`, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | (ZoneSnapshotUi & { ok: true })
    | { ok: false; error?: unknown }
    | null;
  if (!response.ok || !data || data.ok !== true) {
    const mensaje =
      data && data.ok === false && typeof data.error === "string"
        ? data.error
        : mensajeErrorBusqueda(response.status);
    throw new ErrorBusquedaUi(response.status, mensaje);
  }
  return data;
}

export function fetchZonaPreparar(criterios: CriteriosZonaUi, signal?: AbortSignal): Promise<ZoneSnapshotUi> {
  return peticionZona(
    "/prepare",
    {
      provincia: criterios.provincia,
      municipio: criterios.municipio,
      postalCode: criterios.postalCode,
      horizontalDivision: criterios.horizontalDivision,
      ...(criterios.streetOffset && criterios.streetOffset > 0
        ? { streetOffset: criterios.streetOffset }
        : {}),
    },
    signal
  );
}

export function fetchZonaPaso(
  zoneSearchId: string,
  signal?: AbortSignal,
  budgetMs = ZONE_STEP_CLIENT_BUDGET_MS
): Promise<ZoneSnapshotUi> {
  return peticionZona("/step", { zoneSearchId, budgetMs }, signal);
}

export function fetchZonaCancelar(zoneSearchId: string): Promise<ZoneSnapshotUi> {
  return peticionZona("/cancel", { zoneSearchId });
}

export function fetchZonaReanudar(zoneSearchId: string, retryErrors = false): Promise<ZoneSnapshotUi> {
  return peticionZona("/resume", { zoneSearchId, retryErrors });
}

export function fetchZonaEstado(zoneSearchId: string, signal?: AbortSignal): Promise<ZoneSnapshotUi> {
  return peticionZona(`?zoneSearchId=${encodeURIComponent(zoneSearchId)}`, null, signal, "GET");
}
