/**
 * Búsqueda por zona: municipio + código postal.
 *
 * HTTP → search-zone → zone-search → callejero oficial → commercial-search (por calle) → discovery → Catastro
 *
 * Catastro no acepta el CP como criterio. Aquí se recorren las calles oficiales del
 * municipio con el discovery existente (una calle = una búsqueda comercial paginada) y se
 * conservan solo las fincas cuyo `postalCodes[]` contiene el CP. Con CP, discovery
 * aplica un prefiltro seguro antes de DNPRC/ltp; el filtro final se mantiene.
 */
import { filtrarPorDivision, fusionarFincas, parsearFiltroDivision } from "./candidates";
import { getCatastroClient, type CatastroClient } from "./client";
import { getCatalogCache, obtenerCallejeroOficial, type CatalogCache } from "./catalog";
import {
  buscarFincasComerciales,
  ordenarFincasComerciales,
  type CriteriosBusquedaComercial,
  type EjecucionBusquedaComercial,
  type ErrorBusquedaComercial,
  type Finca,
} from "./commercial-search";
import {
  ZONE_DEFAULT_CONCURRENCY,
  ZONE_MAX_CONCURRENCY,
  ZONE_MAX_CONSECUTIVE_FAILURES,
  ZONE_MAX_ERRORS_REPORTED,
  ZONE_STEP_DEFAULT_BUDGET_MS,
  ZONE_STEP_MAX_BUDGET_MS,
  ZONE_STREET_PAGE_SIZE,
} from "./constants";
import { getDiscoveryStore, type DiscoverySessionStore } from "./discovery-session";
import {
  PREFILTRO_CODIGO_POSTAL_VACIO,
  sumarPrefiltroCodigoPostal,
  type PrefiltroCodigoPostal,
} from "./finca";
import {
  claveZona,
  estadoCalleInicial,
  getZoneStore,
  type CriteriosZonaNormalizados,
  type EstadoCalleZona,
  type ZoneSession,
  type ZoneSessionStore,
  type ZoneStatus,
} from "./zone-session";

export type { CriteriosZonaNormalizados, EstadoCalleZona, ZoneSession, ZoneStatus };

export type CriteriosZona = {
  provincia?: string;
  municipio?: string;
  postalCode?: string;
  horizontalDivision?: string;
  /** Rechazados: la zona no admite calle ni número. */
  via?: string;
  calle?: string;
  sigla?: string;
  numero?: string;
};

export type BuscarCalle = (
  criterios: CriteriosBusquedaComercial,
  options: { client?: CatastroClient; store?: DiscoverySessionStore; concurrency?: number }
) => Promise<EjecucionBusquedaComercial | ErrorBusquedaComercial>;

export type ZoneDeps = {
  client?: CatastroClient;
  catalogCache?: CatalogCache;
  discoveryStore?: DiscoverySessionStore;
  zoneStore?: ZoneSessionStore;
  /** Inyectable en tests; por defecto `buscarFincasComerciales`. */
  buscar?: BuscarCalle;
  now?: () => number;
};

export type CoberturaZona = {
  streetsFound: number;
  streetsProcessed: number;
  streetsWithErrors: number;
  complete: boolean;
  completeCandidates: boolean;
  possibleCut: boolean;
};

export type ProgresoZona = {
  streetsFound: number;
  streetsProcessed: number;
  streetsWithErrors: number;
  streetsPending: number;
  streetsInProgress: number;
  /** Fincas únicas cuyo CP coincide, con cualquier división. */
  fincasFound: number;
  /** Fincas que además cumplen el filtro de división elegido. */
  candidates: number;
  portalsProcessed: number;
  steps: number;
  workMs: number;
};

export type ErrorCalleZona = { street: string; error: string };

export type ZoneSnapshot = {
  ok: true;
  zoneSearchId: string;
  status: ZoneStatus;
  criteria: {
    provincia: string;
    municipio: string;
    postalCode: string;
    horizontalDivision: CriteriosZonaNormalizados["horizontalDivision"];
  };
  progress: ProgresoZona;
  coverage: CoberturaZona;
  results: Finca[];
  errors: ErrorCalleZona[];
  /** Qué puede hacer el cliente ahora. */
  nextAction: "start" | "step" | "resume" | "none";
  /** Interno: el adaptador HTTP no lo reenvía. */
  stats: PrefiltroCodigoPostal;
};

export type OpcionesPasoZona = {
  budgetMs?: number;
  concurrency?: number;
  signal?: AbortSignal;
  pageSize?: number;
};

export class ZoneBusyError extends Error {
  constructor() {
    super("La búsqueda por zona ya está procesando un paso.");
    this.name = "ZoneBusyError";
  }
}

function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

function acotar(valor: number | undefined, defecto: number, maximo: number, minimo = 1): number {
  if (valor == null || !Number.isFinite(valor)) return defecto;
  return Math.min(Math.max(minimo, Math.floor(valor)), maximo);
}

export function normalizarCriteriosZona(
  input: CriteriosZona
): { ok: true; criterios: CriteriosZonaNormalizados } | { ok: false; error: string } {
  const provincia = input.provincia?.trim() ?? "";
  const municipio = input.municipio?.trim() ?? "";
  const postalCode = input.postalCode?.replace(/\s+/g, "") ?? "";
  const extra = [input.via, input.calle, input.sigla, input.numero].filter(
    (valor) => valor != null && valor.trim() !== ""
  );

  if (extra.length > 0) {
    return { ok: false, error: "La búsqueda por zona no admite calle ni número." };
  }
  const faltan = [
    !provincia ? "provincia" : null,
    !municipio ? "municipio" : null,
    !postalCode ? "postalCode" : null,
  ].filter((campo): campo is string => campo !== null);
  if (faltan.length > 0) {
    return { ok: false, error: `Faltan parámetros obligatorios: ${faltan.join(", ")}.` };
  }
  if (!/^\d{5}$/.test(postalCode)) {
    return { ok: false, error: "El código postal debe tener 5 dígitos." };
  }
  const filtro = parsearFiltroDivision(input.horizontalDivision ?? "NO");
  if (!filtro.ok) return filtro;

  return {
    ok: true,
    criterios: {
      provincia: normalizarTexto(provincia),
      municipio: normalizarTexto(municipio),
      postalCode,
      horizontalDivision: filtro.value,
    },
  };
}

export type ResultadoPreparacionZona =
  | { ok: true; session: ZoneSession; reused: boolean }
  | { ok: false; code: "invalid" | "upstream" | "limit"; error: string };

/**
 * Fase de preparación: solo lista las calles oficiales. No recorre nada.
 * Si el usuario ya tiene una sesión para la misma zona, se reutiliza con su progreso.
 */
export async function prepararZona(
  input: CriteriosZona,
  user: { id: string },
  deps: ZoneDeps = {}
): Promise<ResultadoPreparacionZona> {
  const parsed = normalizarCriteriosZona(input);
  if (!parsed.ok) return { ok: false, code: "invalid", error: parsed.error };
  const criterios = parsed.criterios;
  const zoneStore = deps.zoneStore ?? getZoneStore();
  const clave = claveZona(criterios);

  const existente = zoneStore.findByKey(user.id, clave);
  if (existente) {
    // El filtro de división se aplica a la salida; la misma zona no se vuelve a recorrer.
    existente.criterios = { ...existente.criterios, horizontalDivision: criterios.horizontalDivision };
    zoneStore.touch(existente);
    return { ok: true, session: existente, reused: true };
  }

  const callejero = await obtenerCallejeroOficial(criterios.provincia, criterios.municipio, {
    client: deps.client ?? getCatastroClient(),
    cache: deps.catalogCache ?? getCatalogCache(),
  });
  if (!callejero.ok) return { ok: false, code: callejero.code, error: callejero.error };

  const creada = zoneStore.create({
    userId: user.id,
    claveZona: clave,
    criterios,
    provinciaOficial: callejero.callejero.provincia.name,
    municipioOficial: callejero.callejero.municipio.name,
    calles: callejero.callejero.calles,
  });
  if (!creada.ok) return { ok: false, code: "limit", error: creada.error };
  return { ok: true, session: creada.session, reused: false };
}

function etiquetaCalle(estado: EstadoCalleZona): string {
  return `${estado.calle.sigla} ${estado.calle.name}`.trim();
}

function siguienteCallePendiente(session: ZoneSession): EstadoCalleZona | null {
  // Primero las calles a medias (con cursor), luego el orden oficial.
  return (
    session.calles.find((calle) => calle.status === "pending" && calle.cursor) ??
    session.calles.find((calle) => calle.status === "pending") ??
    null
  );
}

function mezclarFincas(session: ZoneSession, fincas: Finca[], estado: EstadoCalleZona): void {
  for (const finca of fincas) {
    const previa = session.fincas.get(finca.fincaReference);
    if (!previa) estado.fincas += 1;
    session.fincas.set(finca.fincaReference, fusionarFincas(previa, finca));
  }
}

function mensajeError(error: ErrorBusquedaComercial): string {
  return typeof error.error === "string" ? error.error : error.error.descripcion;
}

/**
 * Un HTTP 4xx de Catastro para una calle concreta (p. ej. 404 en INSPIRE o en una RC) es
 * un problema de esa calle, no una caída del servicio: no cuenta para la pausa de protección.
 */
export function cuentaParaProteccion(mensaje: string): boolean {
  return !/HTTP 4\d\d/.test(mensaje);
}

/**
 * Procesa una calle página a página hasta terminarla o agotar presupuesto/cancelación.
 * Un fallo individual deja la calle en `error` y no detiene la zona.
 */
async function procesarCalle(
  session: ZoneSession,
  estado: EstadoCalleZona,
  contexto: {
    buscar: BuscarCalle;
    opciones: { client?: CatastroClient; store?: DiscoverySessionStore };
    pageSize: number;
    deadline: number;
    now: () => number;
    debeParar: () => boolean;
  }
): Promise<void> {
  estado.status = "running";
  estado.attempts += 1;

  while (true) {
    const respuesta = await contexto.buscar(
      {
        provincia: session.provinciaOficial,
        municipio: session.municipioOficial,
        sigla: estado.calle.sigla,
        via: estado.calle.name,
        postalCode: session.criterios.postalCode,
        horizontalDivision: "ALL",
        pageSize: contexto.pageSize,
        cursor: estado.cursor ?? undefined,
      },
      contexto.opciones
    );

    if (!respuesta.ok) {
      if (respuesta.code === "not_found") {
        // Calle oficial sin portales/fincas para Catastro: 0 resultados, no es error.
        estado.status = "done";
        estado.cursor = null;
        session.consecutiveFailures = 0;
        return;
      }
      if (respuesta.code === "expired" && estado.cursor && estado.attempts <= 2) {
        // La paginación interna caducó: la calle se repite desde el principio (todo cacheado).
        estado.cursor = null;
        estado.pages = 0;
        estado.portalsProcessed = 0;
        estado.status = "pending";
        return;
      }
      estado.status = "error";
      estado.error = mensajeError(respuesta);
      estado.cursor = null;
      if (cuentaParaProteccion(estado.error)) session.consecutiveFailures += 1;
      return;
    }

    session.consecutiveFailures = 0;
    const { resultado } = respuesta;
    const extra = respuesta.discovery?.prefilter ?? PREFILTRO_CODIGO_POSTAL_VACIO;
    session.prefilter = sumarPrefiltroCodigoPostal(session.prefilter, extra);
    mezclarFincas(session, resultado.results, estado);
    estado.pages += 1;
    estado.portalsFound = resultado.coverage.portalsFound;
    estado.portalsProcessed += resultado.coverage.portalsProcessed;
    estado.possibleCut = estado.possibleCut || resultado.coverage.possibleCut;
    estado.completeCandidates = resultado.coverage.completeCandidates;

    if (resultado.pagination.hasNextPage && resultado.pagination.nextCursor) {
      estado.cursor = resultado.pagination.nextCursor;
      if (contexto.debeParar() || contexto.now() >= contexto.deadline) {
        estado.status = "pending";
        return;
      }
      continue;
    }

    estado.status = "done";
    estado.cursor = null;
    return;
  }
}

function recalcularEstado(session: ZoneSession): void {
  const pendientes = session.calles.some((calle) => calle.status === "pending" || calle.status === "running");
  if (!pendientes) {
    session.status = "done";
    return;
  }
  if (session.cancelRequested) {
    session.status = "cancelled";
    return;
  }
  if (session.consecutiveFailures >= ZONE_MAX_CONSECUTIVE_FAILURES) {
    session.status = "upstream_paused";
    return;
  }
  session.status = "paused";
}

/**
 * Un paso: trabaja hasta `budgetMs` con `concurrency` calles simultáneas y devuelve.
 * El cliente encadena pasos; así la UI nunca se bloquea y cada petición HTTP queda acotada.
 */
export async function ejecutarPasoZona(
  session: ZoneSession,
  opciones: OpcionesPasoZona = {},
  deps: ZoneDeps = {}
): Promise<ZoneSnapshot> {
  if (session.status === "running") throw new ZoneBusyError();
  const now = deps.now ?? Date.now;
  const zoneStore = deps.zoneStore ?? getZoneStore();

  if (session.status === "done" || session.status === "cancelled" || session.status === "upstream_paused") {
    return snapshotZona(session);
  }

  const budgetMs = acotar(opciones.budgetMs, ZONE_STEP_DEFAULT_BUDGET_MS, ZONE_STEP_MAX_BUDGET_MS, 0);
  const concurrency = acotar(opciones.concurrency, ZONE_DEFAULT_CONCURRENCY, ZONE_MAX_CONCURRENCY);
  const pageSize = acotar(opciones.pageSize, ZONE_STREET_PAGE_SIZE, 80);
  const buscar = deps.buscar ?? buscarFincasComerciales;
  const opcionesBusqueda = {
    client: deps.client ?? getCatastroClient(),
    store: deps.discoveryStore ?? getDiscoveryStore(),
  };
  const inicio = now();
  const deadline = inicio + budgetMs;
  const debeParar = () =>
    Boolean(opciones.signal?.aborted) ||
    session.cancelRequested ||
    session.consecutiveFailures >= ZONE_MAX_CONSECUTIVE_FAILURES;

  session.status = "running";
  if (budgetMs > 0) session.steps += 1;

  async function worker() {
    while (!debeParar() && now() < deadline) {
      const estado = siguienteCallePendiente(session);
      if (!estado) return;
      await procesarCalle(session, estado, {
        buscar,
        opciones: opcionesBusqueda,
        pageSize,
        deadline,
        now,
        debeParar,
      });
    }
  }

  try {
    const pendientes = session.calles.filter((calle) => calle.status === "pending").length;
    await Promise.all(
      Array.from({ length: Math.min(concurrency, Math.max(pendientes, 1)) }, () => worker())
    );
  } finally {
    for (const calle of session.calles) {
      if (calle.status === "running") calle.status = "pending";
    }
    session.workMs += now() - inicio;
    recalcularEstado(session);
    zoneStore.touch(session);
  }

  return snapshotZona(session);
}

export function cancelarZona(session: ZoneSession, deps: ZoneDeps = {}): ZoneSnapshot {
  session.cancelRequested = true;
  if (session.status !== "running") {
    const pendientes = session.calles.some((calle) => calle.status === "pending");
    session.status = pendientes ? "cancelled" : "done";
  }
  (deps.zoneStore ?? getZoneStore()).touch(session);
  return snapshotZona(session);
}

export function reanudarZona(
  session: ZoneSession,
  opciones: { reintentarErrores?: boolean } = {},
  deps: ZoneDeps = {}
): ZoneSnapshot {
  if (session.status === "running") throw new ZoneBusyError();
  session.cancelRequested = false;
  session.consecutiveFailures = 0;
  if (opciones.reintentarErrores) {
    for (const calle of session.calles) {
      if (calle.status === "error") {
        const limpia = estadoCalleInicial(calle.calle);
        Object.assign(calle, { ...limpia, attempts: calle.attempts });
      }
    }
  }
  const pendientes = session.calles.some((calle) => calle.status === "pending");
  session.status = pendientes ? "prepared" : "done";
  (deps.zoneStore ?? getZoneStore()).touch(session);
  return snapshotZona(session);
}

/** Orden estable: municipio → vía oficial → número oficial (comparador existente). */
export function ordenarFincasZona(fincas: Finca[]): Finca[] {
  const grupos = new Map<string, Finca[]>();
  for (const finca of fincas) {
    const clave = [
      finca.address.municipio ?? "",
      finca.address.sigla ?? "",
      finca.address.via ?? "",
    ]
      .join("|")
      .toUpperCase();
    const grupo = grupos.get(clave) ?? [];
    grupo.push(finca);
    grupos.set(clave, grupo);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .flatMap(([, grupo]) => ordenarFincasComerciales(grupo));
}

export function coberturaZona(session: ZoneSession): CoberturaZona {
  const streetsFound = session.calles.length;
  const procesadas = session.calles.filter((calle) => calle.status === "done" || calle.status === "error");
  const streetsWithErrors = session.calles.filter((calle) => calle.status === "error").length;
  const possibleCut = session.calles.some((calle) => calle.possibleCut);
  const complete =
    session.status === "done" &&
    procesadas.length === streetsFound &&
    streetsWithErrors === 0 &&
    !possibleCut;
  const completeCandidates =
    complete && session.calles.every((calle) => calle.status !== "done" || calle.completeCandidates);
  return {
    streetsFound,
    streetsProcessed: procesadas.length,
    streetsWithErrors,
    complete,
    completeCandidates,
    possibleCut,
  };
}

function siguienteAccion(session: ZoneSession): ZoneSnapshot["nextAction"] {
  if (session.status === "prepared") return session.steps === 0 ? "start" : "step";
  if (session.status === "paused" || session.status === "running") return "step";
  if (session.status === "cancelled" || session.status === "upstream_paused") return "resume";
  return "none";
}

export function snapshotZona(session: ZoneSession): ZoneSnapshot {
  const cobertura = coberturaZona(session);
  const todas = [...session.fincas.values()];
  const filtradas = filtrarPorDivision(todas, session.criterios.horizontalDivision);
  const errores = session.calles
    .filter((calle) => calle.status === "error" && calle.error)
    .slice(0, ZONE_MAX_ERRORS_REPORTED)
    .map((calle) => ({ street: etiquetaCalle(calle), error: calle.error ?? "" }));

  return {
    ok: true,
    zoneSearchId: session.id,
    status: session.status,
    criteria: {
      provincia: session.provinciaOficial,
      municipio: session.municipioOficial,
      postalCode: session.criterios.postalCode,
      horizontalDivision: session.criterios.horizontalDivision,
    },
    progress: {
      streetsFound: cobertura.streetsFound,
      streetsProcessed: cobertura.streetsProcessed,
      streetsWithErrors: cobertura.streetsWithErrors,
      streetsPending: session.calles.filter((calle) => calle.status === "pending").length,
      streetsInProgress: session.calles.filter((calle) => calle.status === "running").length,
      fincasFound: todas.length,
      candidates: filtradas.length,
      portalsProcessed: session.calles.reduce((total, calle) => total + calle.portalsProcessed, 0),
      steps: session.steps,
      workMs: session.workMs,
    },
    coverage: cobertura,
    results: ordenarFincasZona(filtradas),
    errors: errores,
    nextAction: siguienteAccion(session),
    stats: { ...session.prefilter },
  };
}
