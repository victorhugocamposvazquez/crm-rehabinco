/**
 * Sesiones en memoria de la búsqueda por zona (municipio + CP).
 * Permiten cancelar y reanudar dentro de la misma sesión de navegador.
 * Sin Redis/Postgres en esta fase.
 */
import type { FiltroDivisionHorizontal } from "./candidates";
import type { CalleCatalogo } from "./catalog";
import {
  ZONE_MAX_ACTIVE_PER_USER,
  ZONE_SESSION_MAX,
  ZONE_SESSION_TTL_MS,
} from "./constants";
import {
  PREFILTRO_CODIGO_POSTAL_VACIO,
  type FincaDescubierta,
  type PrefiltroCodigoPostal,
} from "./finca";

export type CriteriosZonaNormalizados = {
  provincia: string;
  municipio: string;
  postalCode: string;
  horizontalDivision: FiltroDivisionHorizontal;
};

export type EstadoCalleZona = {
  calle: CalleCatalogo;
  status: "pending" | "running" | "done" | "error";
  /** Cursor de paginación pendiente dentro de la calle. */
  cursor: string | null;
  pages: number;
  portalsFound: number;
  portalsProcessed: number;
  /** Fincas (con CP coincidente) aportadas por esta calle. */
  fincas: number;
  possibleCut: boolean;
  completeCandidates: boolean;
  error: string | null;
  attempts: number;
};

export type ZoneStatus =
  | "prepared"
  | "running"
  | "paused"
  | "cancelled"
  | "upstream_paused"
  | "done";

export type ZoneSession = {
  id: string;
  userId: string;
  claveZona: string;
  criterios: CriteriosZonaNormalizados;
  provinciaOficial: string;
  municipioOficial: string;
  calles: EstadoCalleZona[];
  /** Única por fincaReference; portales acumulados entre calles. */
  fincas: Map<string, FincaDescubierta>;
  status: ZoneStatus;
  cancelRequested: boolean;
  consecutiveFailures: number;
  steps: number;
  workMs: number;
  /** Interno: no se envía al frontend. */
  prefilter: PrefiltroCodigoPostal;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type ZoneSessionStore = {
  create(input: {
    userId: string;
    claveZona: string;
    criterios: CriteriosZonaNormalizados;
    provinciaOficial: string;
    municipioOficial: string;
    calles: CalleCatalogo[];
  }): { ok: true; session: ZoneSession } | { ok: false; error: string };
  get(id: string): ZoneSession | null;
  findByKey(userId: string, claveZona: string): ZoneSession | null;
  touch(session: ZoneSession): void;
  delete(id: string): void;
  size(): number;
  activeFor(userId: string): number;
};

export type ZoneStoreOptions = {
  ttlMs?: number;
  maxSessions?: number;
  maxActivePerUser?: number;
  now?: () => number;
  idFactory?: () => string;
};

const ESTADOS_ACTIVOS: ReadonlySet<ZoneStatus> = new Set(["prepared", "running", "paused"]);

export function esZonaActiva(session: ZoneSession): boolean {
  return ESTADOS_ACTIVOS.has(session.status);
}

export function claveZona(criterios: CriteriosZonaNormalizados): string {
  return [criterios.provincia, criterios.municipio, criterios.postalCode]
    .map((valor) => valor.trim().toUpperCase())
    .join("|");
}

export function estadoCalleInicial(calle: CalleCatalogo): EstadoCalleZona {
  return {
    calle,
    status: "pending",
    cursor: null,
    pages: 0,
    portalsFound: 0,
    portalsProcessed: 0,
    fincas: 0,
    possibleCut: false,
    completeCandidates: true,
    error: null,
    attempts: 0,
  };
}

export function createZoneStore(options: ZoneStoreOptions = {}): ZoneSessionStore {
  const ttlMs = options.ttlMs ?? ZONE_SESSION_TTL_MS;
  const maxSessions = options.maxSessions ?? ZONE_SESSION_MAX;
  const maxActivePerUser = options.maxActivePerUser ?? ZONE_MAX_ACTIVE_PER_USER;
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const sessions = new Map<string, ZoneSession>();

  function purge() {
    const t = now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= t && session.status !== "running") sessions.delete(id);
    }
    if (sessions.size <= maxSessions) return;
    // Primero las terminadas/canceladas más antiguas, luego el resto por antigüedad.
    const ordenadas = [...sessions.values()].sort((a, b) => {
      const pa = esZonaActiva(a) ? 1 : 0;
      const pb = esZonaActiva(b) ? 1 : 0;
      return pa - pb || a.updatedAt - b.updatedAt;
    });
    for (const session of ordenadas) {
      if (sessions.size <= maxSessions) break;
      if (session.status === "running") continue;
      sessions.delete(session.id);
    }
  }

  function activeFor(userId: string): number {
    let total = 0;
    for (const session of sessions.values()) {
      if (session.userId === userId && esZonaActiva(session)) total += 1;
    }
    return total;
  }

  return {
    create(input) {
      purge();
      if (activeFor(input.userId) >= maxActivePerUser) {
        return {
          ok: false,
          error: `Ya tienes ${maxActivePerUser} búsquedas por zona en curso. Cancela o termina una antes de preparar otra.`,
        };
      }
      if (sessions.size >= maxSessions) {
        return {
          ok: false,
          error: "El servidor tiene demasiadas búsquedas por zona en curso. Inténtalo en unos minutos.",
        };
      }
      const t = now();
      const session: ZoneSession = {
        id: idFactory(),
        userId: input.userId,
        claveZona: input.claveZona,
        criterios: input.criterios,
        provinciaOficial: input.provinciaOficial,
        municipioOficial: input.municipioOficial,
        calles: input.calles.map(estadoCalleInicial),
        fincas: new Map(),
        status: "prepared",
        cancelRequested: false,
        consecutiveFailures: 0,
        steps: 0,
        workMs: 0,
        prefilter: { ...PREFILTRO_CODIGO_POSTAL_VACIO },
        createdAt: t,
        updatedAt: t,
        expiresAt: t + ttlMs,
      };
      sessions.set(session.id, session);
      return { ok: true, session };
    },
    get(id) {
      purge();
      return sessions.get(id) ?? null;
    },
    findByKey(userId, clave) {
      purge();
      for (const session of sessions.values()) {
        if (session.userId === userId && session.claveZona === clave) return session;
      }
      return null;
    },
    touch(session) {
      const t = now();
      session.updatedAt = t;
      session.expiresAt = t + ttlMs;
    },
    delete(id) {
      sessions.delete(id);
    },
    size() {
      purge();
      return sessions.size;
    },
    activeFor,
  };
}

let storeGlobal: ZoneSessionStore | null = null;

export function getZoneStore(): ZoneSessionStore {
  storeGlobal ??= createZoneStore();
  return storeGlobal;
}
