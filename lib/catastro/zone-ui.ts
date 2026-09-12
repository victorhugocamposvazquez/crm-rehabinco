/**
 * Lógica de interfaz de la búsqueda por zona (código postal), sin React.
 * El componente solo pinta lo que estas funciones deciden; así se prueba con node:test.
 * El navegador habla únicamente con `/api/catastro/zone/*`.
 */
import type { CoberturaExportacion, CriteriosNombreArchivo } from "./selection-export";
import { ErrorBusquedaUi, mensajeErrorBusqueda, type FincaBusquedaUi } from "./search-ui";

// ---------------------------------------------------------------------------
// Modo de búsqueda
// ---------------------------------------------------------------------------

export type ModoBusqueda = "calle" | "zona";

export const MODOS_BUSQUEDA = [
  { value: "calle", label: "Calle" },
  { value: "zona", label: "Código postal" },
] as const satisfies ReadonlyArray<{ value: ModoBusqueda; label: string }>;

export const EXPLICACION_ZONA =
  "El código postal se utiliza como filtro sobre los resultados oficiales de Catastro. Catastro no permite buscar directamente por código postal.";

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

export type EstadoZonaUi = {
  fase: FaseZona;
  zoneSearchId: string | null;
  snapshot: ZoneSnapshotUi | null;
  error: string | null;
  /** Instante en que el usuario pulsó Comenzar (o Reanudar); para el ritmo medido. */
  inicioMs: number | null;
  /** Calles ya procesadas al arrancar el tramo actual. */
  procesadasAlInicio: number;
};

export const ESTADO_ZONA_INICIAL: EstadoZonaUi = {
  fase: "formulario",
  zoneSearchId: null,
  snapshot: null,
  error: null,
  inicioMs: null,
  procesadasAlInicio: 0,
};

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
      error:
        "La búsqueda por zona ha caducado en el servidor. Los resultados ya obtenidos siguen disponibles; prepárala de nuevo para continuar.",
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

export function textoPreparacion(streetsFound: number): string {
  if (streetsFound === 0) {
    return "Catastro no devuelve calles oficiales para este municipio. No hay nada que recorrer.";
  }
  return `Se ${plural(streetsFound, "ha encontrado", "han encontrado")} ${streetsFound} ${plural(
    streetsFound,
    "calle oficial",
    "calles oficiales"
  )} en este municipio. La búsqueda recorrerá esas calles y filtrará después por código postal.`;
}

export function textoCallesARevisar(streetsFound: number): string {
  return `Calles a revisar: ${streetsFound}`;
}

export function etiquetaCandidatas(horizontalDivision: string): string {
  const filtro = horizontalDivision.trim().toUpperCase();
  if (filtro === "NO") return "Candidatas sin división horizontal";
  if (filtro === "YES") return "Fincas con división horizontal";
  if (filtro === "UNKNOWN") return "Fincas con división no determinada";
  if (filtro === "NOT_APPLICABLE") return "Fincas no aplicables";
  return "Fincas con el código postal";
}

export function textosProgreso(snapshot: ZoneSnapshotUi): {
  calles: string;
  fincas: string;
  candidatas: string;
  errores: string | null;
  porcentaje: number;
} {
  const { progress } = snapshot;
  const porcentaje =
    progress.streetsFound === 0
      ? 100
      : Math.floor((progress.streetsProcessed / progress.streetsFound) * 100);
  return {
    calles: `Calles revisadas: ${progress.streetsProcessed} / ${progress.streetsFound}`,
    fincas: `Fincas encontradas: ${progress.fincasFound}`,
    candidatas: `${etiquetaCandidatas(snapshot.criteria.horizontalDivision)}: ${progress.candidates}`,
    errores:
      progress.streetsWithErrors > 0 ? `Calles con errores: ${progress.streetsWithErrors}` : null,
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
};

export function accionesDisponibles(estado: EstadoZonaUi): AccionesZona {
  const snapshot = estado.snapshot;
  const pendientes = (snapshot?.progress.streetsPending ?? 0) > 0;
  const conErrores = (snapshot?.progress.streetsWithErrors ?? 0) > 0;
  switch (estado.fase) {
    case "formulario":
    case "error":
      return {
        preparar: true,
        comenzar: false,
        cancelar: false,
        reanudar: estado.fase === "error" && Boolean(snapshot) && pendientes,
        reintentarErrores: false,
        nuevaBusqueda: Boolean(snapshot),
      };
    case "preparando":
      return { preparar: false, comenzar: false, cancelar: false, reanudar: false, reintentarErrores: false, nuevaBusqueda: false };
    case "preparada":
      return {
        preparar: false,
        comenzar: (snapshot?.progress.streetsFound ?? 0) > 0,
        cancelar: false,
        reanudar: false,
        reintentarErrores: false,
        nuevaBusqueda: true,
      };
    case "ejecutando":
      return { preparar: false, comenzar: false, cancelar: true, reanudar: false, reintentarErrores: false, nuevaBusqueda: false };
    case "cancelada":
    case "pausada_por_catastro":
      return {
        preparar: false,
        comenzar: false,
        cancelar: false,
        reanudar: pendientes,
        reintentarErrores: !pendientes && conErrores,
        nuevaBusqueda: true,
      };
    case "completada":
      return {
        preparar: false,
        comenzar: false,
        cancelar: false,
        reanudar: false,
        reintentarErrores: conErrores,
        nuevaBusqueda: true,
      };
    case "caducada":
      return { preparar: true, comenzar: false, cancelar: false, reanudar: false, reintentarErrores: false, nuevaBusqueda: true };
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
    completeCandidates: snapshot.status === "done" && snapshot.coverage.completeCandidates,
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
  return peticionZona("/prepare", criterios, signal);
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
