/**
 * Persistencia portable de la sesión de zona. El motor no conoce Supabase:
 * el host guarda y recupera el JSON entre isolates (Vercel).
 */
import { PREFILTRO_CODIGO_POSTAL_VACIO, type FincaDescubierta } from "./finca";
import type { ZoneSession, ZoneStatus } from "./zone-session";

export type ZoneSessionArchive = {
  get(id: string, userId: string): Promise<ZoneSession | null>;
  findByKey(userId: string, claveZona: string): Promise<ZoneSession | null>;
  put(session: ZoneSession): Promise<void>;
  countActive(userId: string): Promise<number>;
};

export type ZoneSessionPayload = Omit<ZoneSession, "fincas"> & {
  fincas: Array<[string, FincaDescubierta]>;
};

const ESTADOS: ReadonlySet<ZoneStatus> = new Set([
  "prepared",
  "running",
  "paused",
  "cancelled",
  "upstream_paused",
  "done",
]);

function fincaArchivada(finca: FincaDescubierta): FincaDescubierta {
  return {
    ...finca,
    properties: finca.properties.map((propiedad) => ({ ...propiedad, unidades: [] })),
  };
}

function calleArchivada(calle: ZoneSession["calles"][number]): ZoneSession["calles"][number] {
  if (calle.status !== "running") return calle;
  return { ...calle, status: "pending" };
}

/** `running` es efímero del isolate: en disco siempre queda pausada. */
export function serializarSesionZona(session: ZoneSession): ZoneSessionPayload {
  return {
    ...session,
    status: session.status === "running" ? "paused" : session.status,
    calles: session.calles.map(calleArchivada),
    fincas: [...session.fincas.entries()].map(([clave, finca]) => [clave, fincaArchivada(finca)]),
  };
}

export function hidratarSesionZona(raw: unknown): ZoneSession | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Partial<ZoneSessionPayload>;
  if (typeof payload.id !== "string" || typeof payload.userId !== "string") return null;
  if (!payload.criterios || !Array.isArray(payload.calles)) return null;
  if (payload.status == null || !ESTADOS.has(payload.status)) return null;
  const fincas = new Map<string, FincaDescubierta>();
  if (Array.isArray(payload.fincas)) {
    for (const entrada of payload.fincas) {
      if (!Array.isArray(entrada) || typeof entrada[0] !== "string" || !entrada[1]) continue;
      fincas.set(entrada[0], entrada[1] as FincaDescubierta);
    }
  }
  const calles = payload.calles.map(calleArchivada);
  return {
    id: payload.id,
    userId: payload.userId,
    claveZona: typeof payload.claveZona === "string" ? payload.claveZona : "",
    criterios: payload.criterios,
    provinciaOficial: payload.provinciaOficial ?? "",
    municipioOficial: payload.municipioOficial ?? "",
    calles,
    streetsTotal: Number(payload.streetsTotal) || payload.calles.length,
    streetOffset: Number(payload.streetOffset) || 0,
    fincas,
    status: payload.status === "running" ? "paused" : payload.status,
    cancelRequested: Boolean(payload.cancelRequested),
    consecutiveFailures: Number(payload.consecutiveFailures) || 0,
    steps: Number(payload.steps) || 0,
    workMs: Number(payload.workMs) || 0,
    prefilter: payload.prefilter ?? { ...PREFILTRO_CODIGO_POSTAL_VACIO },
    createdAt: Number(payload.createdAt) || Date.now(),
    updatedAt: Number(payload.updatedAt) || Date.now(),
    expiresAt: Number(payload.expiresAt) || Date.now(),
  };
}
