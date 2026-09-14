/**
 * Adaptador HTTP de la búsqueda por zona.
 *
 * POST /api/catastro/zone/prepare  → lista calles oficiales, crea/reutiliza la sesión (no recorre nada)
 * POST /api/catastro/zone/step     → trabaja un paso acotado y devuelve progreso + resultados
 * POST /api/catastro/zone/cancel   → deja de programar calles; conserva lo obtenido
 * POST /api/catastro/zone/resume   → continúa por las calles pendientes (opcional: reintentar errores)
 * GET  /api/catastro/zone          → estado actual
 *
 * Límites impuestos aquí y en el dominio: 2 zonas activas por usuario, 20 sesiones en total,
 * un paso a la vez por sesión (409), presupuesto ≤ 25 s y ≤ 5 calles simultáneas por paso.
 */
import {
  clockSistema,
  estadoZonaHaciaExplorer,
  persistirBusqueda,
  propuestaBusqueda,
  type ExplorerClock,
  type ExplorerStore,
} from "./explorer";
import { elegirSesionZona, type ZoneSessionArchive } from "./zone-archive";
import { ZONE_STEP_MAX_BUDGET_MS } from "./constants";
import { getZoneStore, type ZoneSession } from "./zone-session";
import {
  cancelarZona,
  ejecutarPasoZona,
  prepararZona,
  reanudarZona,
  snapshotZona,
  ZoneBusyError,
  type ZoneDeps,
  type ZoneSnapshot,
} from "./zone-search";

export type ZoneHttpDeps = ZoneDeps & {
  explorerStore?: ExplorerStore;
  archive?: ZoneSessionArchive;
  clock?: ExplorerClock;
  /** Host: persiste el explorer store fuera del tiempo de respuesta HTTP. */
  diferir?: (tarea: () => Promise<void>) => void;
};

type Parametros = Record<string, string>;

function json(cuerpo: Record<string, unknown>, status = 200): Response {
  return Response.json(cuerpo, { status });
}

/** El prefiltro es métrica interna: no viaja al frontend. */
function cuerpoZona(snapshot: ZoneSnapshot, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const { stats: _stats, ...publico } = snapshot;
  return { ...publico, ...extra };
}

function error(status: number, mensaje: string): Response {
  return json({ ok: false, error: mensaje }, status);
}

function textoDe(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  if (typeof valor === "boolean") return valor ? "true" : "false";
  return undefined;
}

/** Une query string y cuerpo JSON (si lo hay). Solo escalares; nada anidado. */
export async function leerParametrosZona(request: Request): Promise<Parametros> {
  const params: Parametros = {};
  for (const [clave, valor] of new URL(request.url).searchParams) {
    params[clave.trim()] = valor.trim();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    const tipo = request.headers.get("content-type") ?? "";
    if (tipo.includes("application/json")) {
      try {
        const cuerpo = (await request.json()) as Record<string, unknown> | null;
        if (cuerpo && typeof cuerpo === "object") {
          for (const [clave, valor] of Object.entries(cuerpo)) {
            const texto = textoDe(valor);
            if (texto != null) params[clave.trim()] = texto.trim();
          }
        }
      } catch {
        // Cuerpo inválido: se ignora; la validación posterior avisará de lo que falte.
      }
    }
  }
  return params;
}

function entero(valor: string | undefined): number | undefined {
  if (valor == null || valor === "" || !/^\d+$/.test(valor)) return undefined;
  return Number(valor);
}

async function persistirZona(
  userId: string,
  session: ZoneSession,
  snapshot: ZoneSnapshot,
  deps: ZoneHttpDeps
): Promise<void> {
  if (!deps.explorerStore) return;
  const now = (deps.clock ?? clockSistema).nowIso();
  const fincas = [...session.fincas.values()];
  try {
    await persistirBusqueda(
      deps.explorerStore,
      propuestaBusqueda({
        id: session.id,
        ownerId: userId,
        criteria: {
          mode: "POSTAL_CODE",
          provincia: snapshot.criteria.provincia,
          municipio: snapshot.criteria.municipio,
          postalCode: snapshot.criteria.postalCode,
          horizontalDivision: snapshot.criteria.horizontalDivision,
        },
        status: estadoZonaHaciaExplorer(session.status),
        coverage: {
          complete: snapshot.coverage.complete,
          completeCandidates: snapshot.coverage.completeCandidates,
          possibleCut: snapshot.coverage.possibleCut,
          streetsFound: snapshot.coverage.streetsFound,
          streetsProcessed: snapshot.coverage.streetsProcessed,
          streetsWithErrors: snapshot.coverage.streetsWithErrors,
          streetsTotal: snapshot.coverage.streetsTotal,
          streetOffset: snapshot.coverage.streetOffset,
        },
        fincas,
        now,
      }),
      fincas,
      now
    );
  } catch (error) {
    console.error("[catastro:explorer-store]", error instanceof Error ? error.message : error);
  }
}

async function persistirExplorerTrasPaso(
  userId: string,
  session: ZoneSession,
  snapshot: ZoneSnapshot,
  deps: ZoneHttpDeps
): Promise<void> {
  if (!deps.explorerStore) return;
  const tarea = () => persistirZona(userId, session, snapshot, deps);
  if (deps.diferir) {
    deps.diferir(() =>
      tarea().catch((error) => {
        console.error("[catastro:explorer-store]", error instanceof Error ? error.message : error);
      })
    );
    return;
  }
  await tarea();
}

async function guardarArchivo(session: ZoneSession, deps: ZoneHttpDeps): Promise<void> {
  if (!deps.archive) return;
  try {
    await deps.archive.put(session);
  } catch (error) {
    console.error("[catastro:zone-archive]", error instanceof Error ? error.message : error);
  }
}

async function sesionDe(
  params: Parametros,
  user: { id: string },
  deps: ZoneHttpDeps
): Promise<{ ok: true; session: ZoneSession } | { ok: false; response: Response }> {
  const id = params.zoneSearchId?.trim();
  if (!id) return { ok: false, response: error(400, "Falta el parámetro zoneSearchId.") };
  const store = deps.zoneStore ?? getZoneStore();
  let enMemoria = store.get(id);
  if (enMemoria && enMemoria.userId !== user.id) enMemoria = null;
  let session = enMemoria;
  if (deps.archive) {
    const archivada = await deps.archive.get(id, user.id);
    const elegida = elegirSesionZona(enMemoria, archivada);
    if (elegida && elegida !== enMemoria) store.put(elegida);
    session = elegida;
  }
  if (!session || session.userId !== user.id) {
    return {
      ok: false,
      response: error(410, "La búsqueda por zona ha caducado o no existe. Prepárala de nuevo."),
    };
  }
  return { ok: true, session };
}

export async function responderZonaPreparar(
  request: Request,
  user: { id: string } | null,
  deps: ZoneHttpDeps = {}
): Promise<Response> {
  if (!user) return error(401, "Sesión expirada");
  const params = await leerParametrosZona(request);
  const resultado = await prepararZona(
    {
      provincia: params.provincia,
      municipio: params.municipio,
      postalCode: params.postalCode ?? params.codigoPostal,
      horizontalDivision: params.horizontalDivision,
      streetOffset: entero(params.streetOffset),
      via: params.via,
      calle: params.calle,
      sigla: params.sigla,
      numero: params.numero,
    },
    user,
    deps
  );
  if (!resultado.ok) {
    const status = resultado.code === "invalid" ? 400 : resultado.code === "limit" ? 429 : 502;
    return error(status, resultado.error);
  }
  const snapshot = snapshotZona(resultado.session);
  await guardarArchivo(resultado.session, deps);
  await persistirZona(user.id, resultado.session, snapshot, deps);
  return json(cuerpoZona(snapshot, { reused: resultado.reused }));
}

export async function responderZonaPaso(
  request: Request,
  user: { id: string } | null,
  deps: ZoneHttpDeps = {}
): Promise<Response> {
  if (!user) return error(401, "Sesión expirada");
  const params = await leerParametrosZona(request);
  const sesion = await sesionDe(params, user, deps);
  if (!sesion.ok) return sesion.response;
  const archive = deps.archive;
  let claimed = true;
  if (archive?.tryClaim) {
    claimed = await archive.tryClaim(sesion.session.id, user.id);
    if (!claimed) return error(409, "La búsqueda por zona ya está procesando un paso.");
  }
  try {
    const snapshot = await ejecutarPasoZona(
      sesion.session,
      {
        budgetMs: entero(params.budgetMs),
        concurrency: entero(params.concurrency),
        retryErrors: params.retryErrors === "true",
      },
      deps
    );
    await guardarArchivo(sesion.session, deps);
    await persistirExplorerTrasPaso(user.id, sesion.session, snapshot, deps);
    return json(cuerpoZona(snapshot));
  } catch (err) {
    if (err instanceof ZoneBusyError) return error(409, err.message);
    console.error("[catastro:zone]", err instanceof Error ? err.message : err);
    try {
      await guardarArchivo(sesion.session, deps);
      const snapshot = snapshotZona(sesion.session);
      await persistirExplorerTrasPaso(user.id, sesion.session, snapshot, deps);
      return json(cuerpoZona(snapshot));
    } catch {
      return error(502, "No se ha podido continuar la búsqueda por zona. Inténtalo de nuevo.");
    }
  } finally {
    if (claimed && archive?.releaseClaim) {
      await archive.releaseClaim(sesion.session.id, user.id).catch(() => undefined);
    }
  }
}

export async function responderZonaCancelar(
  request: Request,
  user: { id: string } | null,
  deps: ZoneHttpDeps = {}
): Promise<Response> {
  if (!user) return error(401, "Sesión expirada");
  const params = await leerParametrosZona(request);
  const sesion = await sesionDe(params, user, deps);
  if (!sesion.ok) return sesion.response;
  const snapshot = cancelarZona(sesion.session, deps);
  await guardarArchivo(sesion.session, deps);
  await persistirZona(user.id, sesion.session, snapshot, deps);
  return json(cuerpoZona(snapshot));
}

export async function responderZonaReanudar(
  request: Request,
  user: { id: string } | null,
  deps: ZoneHttpDeps = {}
): Promise<Response> {
  if (!user) return error(401, "Sesión expirada");
  const params = await leerParametrosZona(request);
  const sesion = await sesionDe(params, user, deps);
  if (!sesion.ok) return sesion.response;
  try {
    const snapshot = reanudarZona(
      sesion.session,
      { reintentarErrores: params.retryErrors === "true" },
      deps
    );
    await guardarArchivo(sesion.session, deps);
    await persistirZona(user.id, sesion.session, snapshot, deps);
    return json(cuerpoZona(snapshot));
  } catch (err) {
    if (err instanceof ZoneBusyError) return error(409, err.message);
    throw err;
  }
}

export async function responderZonaEstado(
  request: Request,
  user: { id: string } | null,
  deps: ZoneHttpDeps = {}
): Promise<Response> {
  if (!user) return error(401, "Sesión expirada");
  const params = await leerParametrosZona(request);
  const sesion = await sesionDe(params, user, deps);
  if (!sesion.ok) return sesion.response;
  return json(cuerpoZona(snapshotZona(sesion.session)));
}

/**
 * Continúa una zona ya persistida sin el navegador.
 * No usa el abort de la petición HTTP: cerrar el CRM no debe parar el paso.
 */
export async function avanzarZonaEnServidor(
  session: ZoneSession,
  deps: ZoneHttpDeps = {}
): Promise<ZoneSnapshot> {
  const store = deps.zoneStore ?? getZoneStore();
  store.put(session);
  store.touch(session);
  if (session.status === "upstream_paused") {
    reanudarZona(session, {}, deps);
  }
  if (session.status === "cancelled" || session.status === "done") {
    return snapshotZona(session);
  }
  const snapshot = await ejecutarPasoZona(session, { budgetMs: ZONE_STEP_MAX_BUDGET_MS }, deps);
  await guardarArchivo(session, deps);
  await persistirZona(session.userId, session, snapshot, deps);
  return snapshot;
}
