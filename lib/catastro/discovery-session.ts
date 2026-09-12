import {
  DISCOVERY_SESSION_MAX,
  DISCOVERY_SESSION_TTL_MS,
} from "./constants";
import type { FincaDescubierta } from "./finca";
import type { DiscoveryQuery } from "./discovery";

export type DiscoverySession = {
  id: string;
  query: DiscoveryQuery;
  numeros: string[];
  possibleCut: boolean;
  limitation: string | null;
  pageSize: number;
  createdAt: number;
  expiresAt: number;
  processed: Set<string>;
  fincaPortals: Map<string, Set<string>>;
  propertyRefs: Map<string, Set<string>>;
  fincaSnapshots: Map<string, FincaDescubierta>;
  portalErrors: Set<string>;
};

export type DiscoveryCursor = {
  v: 1;
  id: string;
  offset: number;
};

export type DiscoverySessionStore = {
  create(input: {
    query: DiscoveryQuery;
    numeros: string[];
    possibleCut: boolean;
    limitation: string | null;
    pageSize: number;
  }): DiscoverySession;
  get(id: string): DiscoverySession | null;
  touch(session: DiscoverySession): void;
  size(): number;
};

type StoreOptions = {
  ttlMs?: number;
  maxSessions?: number;
  now?: () => number;
  idFactory?: () => string;
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeDiscoveryCursor(cursor: DiscoveryCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeDiscoveryCursor(raw: string): DiscoveryCursor | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as Partial<DiscoveryCursor>;
    const offset = parsed.offset;
    if (
      parsed.v !== 1 ||
      typeof parsed.id !== "string" ||
      typeof offset !== "number" ||
      !Number.isInteger(offset) ||
      offset < 0
    ) {
      return null;
    }
    return { v: 1, id: parsed.id, offset };
  } catch {
    return null;
  }
}

export function createDiscoveryStore(options: StoreOptions = {}): DiscoverySessionStore {
  const ttlMs = options.ttlMs ?? DISCOVERY_SESSION_TTL_MS;
  const maxSessions = options.maxSessions ?? DISCOVERY_SESSION_MAX;
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const sessions = new Map<string, DiscoverySession>();

  function purge() {
    const t = now();
    for (const [id, session] of sessions) {
      if (session.expiresAt <= t) sessions.delete(id);
    }
    while (sessions.size > maxSessions) {
      const oldest = sessions.keys().next().value;
      if (!oldest) break;
      sessions.delete(oldest);
    }
  }

  return {
    create(input) {
      purge();
      const createdAt = now();
      const session: DiscoverySession = {
        id: idFactory(),
        query: input.query,
        numeros: input.numeros,
        possibleCut: input.possibleCut,
        limitation: input.limitation,
        pageSize: input.pageSize,
        createdAt,
        expiresAt: createdAt + ttlMs,
        processed: new Set(),
        fincaPortals: new Map(),
        propertyRefs: new Map(),
        fincaSnapshots: new Map(),
        portalErrors: new Set(),
      };
      sessions.set(session.id, session);
      purge();
      return session;
    },
    get(id) {
      purge();
      return sessions.get(id) ?? null;
    },
    touch(session) {
      session.expiresAt = now() + ttlMs;
    },
    size() {
      purge();
      return sessions.size;
    },
  };
}

const storeGlobal = createDiscoveryStore();

export function getDiscoveryStore(): DiscoverySessionStore {
  return storeGlobal;
}

export function recordarFincaEnSesion(
  session: DiscoverySession,
  fincaReference: string,
  portals: string[],
  propertyReferences: string[]
) {
  const portalSet = session.fincaPortals.get(fincaReference) ?? new Set<string>();
  for (const portal of portals) portalSet.add(portal);
  session.fincaPortals.set(fincaReference, portalSet);

  const refs = session.propertyRefs.get(fincaReference) ?? new Set<string>();
  for (const ref of propertyReferences) refs.add(ref);
  session.propertyRefs.set(fincaReference, refs);
}

export function portalesAcumulados(session: DiscoverySession, fincaReference: string): string[] {
  return [...(session.fincaPortals.get(fincaReference) ?? [])].sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b, "es")
  );
}

export function referenciasAcumuladas(
  session: DiscoverySession,
  fincaReference: string
): string[] {
  return [...(session.propertyRefs.get(fincaReference) ?? [])].sort();
}
