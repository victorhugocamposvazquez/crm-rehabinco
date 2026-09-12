/**
 * Cache de catálogo en navegador (provincias / municipios / calles).
 *
 * Browser → cache local (memoria + IndexedDB) → /api/catastro/* → Catastro
 *
 * No toca la fuente oficial ni la búsqueda de fincas. Sin dependencias.
 */

export const CATALOG_CLIENT_VERSION = "1";
/** Frescura: pasado este tiempo se sirve la cache y se revalida en segundo plano. */
export const CATALOG_CLIENT_TTL_MS = 24 * 60 * 60 * 1000;
/** Callejeros distintos que se conservan como máximo en el navegador. */
export const CATALOG_CLIENT_MAX_STREET_CATALOGS = 20;
export const CATALOG_STREETS_PREFIX = "streets:";

export const AVISO_FALLBACK_CATALOGO =
  "Usando datos guardados temporalmente. Se actualizarán cuando Catastro vuelva a estar disponible.";

export type EntradaCatalogo<T> = {
  version: string;
  fetchedAt: number;
  expiresAt: number;
  items: T[];
};

export type CatalogStore = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
};

export type NombreMetricaCatalogo =
  | "catalogCacheHit"
  | "catalogCacheMiss"
  | "catalogRevalidated"
  | "catalogFallback"
  | "catalogLoadMs";

export type MetricaCatalogo = {
  name: NombreMetricaCatalogo;
  key: string;
  value?: number;
  reason?: string;
};

export type FuenteCatalogo = "cache" | "network";

export type EstadoCatalogo<T> = {
  items: T[];
  source: FuenteCatalogo;
  /** La cache había caducado cuando se sirvió. */
  stale: boolean;
  /** Hay una descarga en segundo plano en curso. */
  revalidating: boolean;
  /** La red falló y se mantienen datos guardados. */
  fallback: boolean;
  aviso: string | null;
};

export type OpcionesCargaCatalogo<T> = {
  key: string;
  store: CatalogStore;
  fetcher: (signal: AbortSignal) => Promise<T[]>;
  validarItem: (item: unknown) => item is T;
  signal?: AbortSignal;
  now?: () => number;
  ttlMs?: number;
  version?: string;
  onMetric?: (metrica: MetricaCatalogo) => void;
  inflight?: Map<string, Promise<unknown[]>>;
};

export function claveCacheProvincias(): string {
  return "provinces";
}

export function claveCacheMunicipios(provinceCode: string): string {
  return `municipalities:${provinceCode.trim()}`;
}

export function claveCacheCalles(provinceCode: string, municipalityCode: string): string {
  return `${CATALOG_STREETS_PREFIX}${provinceCode.trim()}:${municipalityCode.trim()}`;
}

export function esEntradaCatalogo<T>(
  valor: unknown,
  version: string,
  validarItem: (item: unknown) => item is T
): valor is EntradaCatalogo<T> {
  if (!valor || typeof valor !== "object") return false;
  const entrada = valor as Record<string, unknown>;
  if (entrada.version !== version) return false;
  if (typeof entrada.fetchedAt !== "number" || !Number.isFinite(entrada.fetchedAt)) return false;
  if (typeof entrada.expiresAt !== "number" || !Number.isFinite(entrada.expiresAt)) return false;
  if (!Array.isArray(entrada.items)) return false;
  return entrada.items.every(validarItem);
}

export function entradaFresca(entrada: { expiresAt: number }, now: number): boolean {
  return entrada.expiresAt > now;
}

export function crearStoreMemoria(): CatalogStore {
  const mapa = new Map<string, unknown>();
  return {
    async get(key) {
      return mapa.get(key);
    },
    async set(key, value) {
      mapa.set(key, value);
    },
    async delete(key) {
      mapa.delete(key);
    },
    async keys() {
      return [...mapa.keys()];
    },
  };
}

/**
 * IndexedDB con espejo en memoria. Si IndexedDB no existe o falla, degrada a memoria:
 * una cache rota nunca bloquea la pantalla.
 */
export function crearStoreIndexedDb(
  nombreDb = "rehabinco-catastro-catalogo",
  nombreStore = "catalogos"
): CatalogStore {
  const memoria = crearStoreMemoria();
  if (typeof indexedDB === "undefined") return memoria;

  let dbPromise: Promise<IDBDatabase | null> | null = null;

  function abrir(): Promise<IDBDatabase | null> {
    dbPromise ??= new Promise((resolve) => {
      try {
        const peticion = indexedDB.open(nombreDb, 1);
        peticion.onupgradeneeded = () => {
          const db = peticion.result;
          if (!db.objectStoreNames.contains(nombreStore)) {
            db.createObjectStore(nombreStore);
          }
        };
        peticion.onsuccess = () => resolve(peticion.result);
        peticion.onerror = () => resolve(null);
        peticion.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function transaccion<T>(
    modo: IDBTransactionMode,
    operar: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T | undefined> {
    return abrir().then(
      (db) =>
        new Promise<T | undefined>((resolve) => {
          if (!db) return resolve(undefined);
          try {
            const tx = db.transaction(nombreStore, modo);
            const peticion = operar(tx.objectStore(nombreStore));
            peticion.onsuccess = () => resolve(peticion.result);
            peticion.onerror = () => resolve(undefined);
            tx.onabort = () => resolve(undefined);
          } catch {
            resolve(undefined);
          }
        })
    );
  }

  return {
    async get(key) {
      const enMemoria = await memoria.get(key);
      if (enMemoria !== undefined) return enMemoria;
      const persistido = await transaccion("readonly", (store) => store.get(key));
      if (persistido !== undefined) await memoria.set(key, persistido);
      return persistido;
    },
    async set(key, value) {
      await memoria.set(key, value);
      await transaccion("readwrite", (store) => store.put(value, key));
    },
    async delete(key) {
      await memoria.delete(key);
      await transaccion("readwrite", (store) => store.delete(key));
    },
    async keys() {
      const persistidas = await transaccion("readonly", (store) => store.getAllKeys());
      const enMemoria = await memoria.keys();
      const todas = new Set<string>(enMemoria);
      for (const clave of persistidas ?? []) {
        if (typeof clave === "string") todas.add(clave);
      }
      return [...todas];
    },
  };
}

let storeCompartido: CatalogStore | null = null;

export function getCatalogClientStore(): CatalogStore {
  storeCompartido ??= crearStoreIndexedDb();
  return storeCompartido;
}

const inflightCompartido = new Map<string, Promise<unknown[]>>();

export function registrarMetricaCatalogo(metrica: MetricaCatalogo): void {
  if (process.env.NODE_ENV === "production") return;
  const detalle: Record<string, unknown> = { key: metrica.key };
  if (metrica.value != null) detalle.value = metrica.value;
  if (metrica.reason) detalle.reason = metrica.reason;
  console.debug(`[catastro:catalog] ${metrica.name}`, detalle);
}

function esAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function leerEntrada<T>(
  opts: OpcionesCargaCatalogo<T>,
  version: string,
  emitir: (metrica: MetricaCatalogo) => void
): Promise<EntradaCatalogo<T> | null> {
  let crudo: unknown;
  try {
    crudo = await opts.store.get(opts.key);
  } catch {
    emitir({ name: "catalogCacheMiss", key: opts.key, reason: "store-error" });
    return null;
  }
  if (crudo === undefined || crudo === null) {
    emitir({ name: "catalogCacheMiss", key: opts.key, reason: "empty" });
    return null;
  }
  if (!esEntradaCatalogo(crudo, version, opts.validarItem)) {
    emitir({ name: "catalogCacheMiss", key: opts.key, reason: "incompatible" });
    try {
      await opts.store.delete(opts.key);
    } catch {
      // La entrada corrupta se ignora aunque no se pueda borrar.
    }
    return null;
  }
  return crudo;
}

function descargarCompartido<T>(opts: OpcionesCargaCatalogo<T>): Promise<T[]> {
  const inflight = opts.inflight ?? inflightCompartido;
  const existente = inflight.get(opts.key);
  if (existente) return existente as Promise<T[]>;
  const controller = new AbortController();
  const pendiente = opts
    .fetcher(controller.signal)
    .then((items) => {
      if (!Array.isArray(items) || !items.every(opts.validarItem)) {
        throw new Error("Catálogo con estructura inesperada.");
      }
      return items;
    })
    .finally(() => {
      inflight.delete(opts.key);
    });
  inflight.set(opts.key, pendiente as Promise<unknown[]>);
  return pendiente;
}

async function guardarEntrada<T>(
  opts: OpcionesCargaCatalogo<T>,
  items: T[],
  now: number,
  ttlMs: number,
  version: string
): Promise<void> {
  const entrada: EntradaCatalogo<T> = {
    version,
    fetchedAt: now,
    expiresAt: now + ttlMs,
    items,
  };
  try {
    await opts.store.set(opts.key, entrada);
    if (opts.key.startsWith(CATALOG_STREETS_PREFIX)) {
      await podarCatalogos(opts.store, CATALOG_STREETS_PREFIX, CATALOG_CLIENT_MAX_STREET_CATALOGS);
    }
  } catch {
    // Sin persistencia seguimos funcionando con la respuesta en memoria.
  }
}

/** Conserva como máximo `maximo` catálogos con ese prefijo; borra los más antiguos. */
export async function podarCatalogos(
  store: CatalogStore,
  prefijo: string,
  maximo: number
): Promise<string[]> {
  const claves = (await store.keys()).filter((key) => key.startsWith(prefijo));
  if (claves.length <= maximo) return [];
  const conFecha = await Promise.all(
    claves.map(async (key) => {
      const valor = (await store.get(key)) as { fetchedAt?: unknown } | undefined;
      const fetchedAt = typeof valor?.fetchedAt === "number" ? valor.fetchedAt : 0;
      return { key, fetchedAt };
    })
  );
  conFecha.sort((a, b) => a.fetchedAt - b.fetchedAt);
  const sobrantes = conFecha.slice(0, conFecha.length - maximo).map((item) => item.key);
  await Promise.all(sobrantes.map((key) => store.delete(key)));
  return sobrantes;
}

/**
 * Stale-while-revalidate.
 *
 * - Sin cache: red → guardar → emitir. Si la red falla, lanza.
 * - Cache fresca: emitir y terminar (0 peticiones).
 * - Cache caducada: emitir ya con `revalidating`, descargar detrás, emitir de nuevo.
 *   Si la red falla, se conservan los datos y se marca `fallback`.
 *
 * `onEstado` puede recibir una o dos emisiones. Nunca se emite tras `signal.abort()`.
 */
export async function cargarCatalogo<T>(
  opts: OpcionesCargaCatalogo<T>,
  onEstado: (estado: EstadoCatalogo<T>) => void
): Promise<EstadoCatalogo<T>> {
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? CATALOG_CLIENT_TTL_MS;
  const version = opts.version ?? CATALOG_CLIENT_VERSION;
  const emitirMetrica = opts.onMetric ?? registrarMetricaCatalogo;
  const inicio = now();
  const vivo = () => !opts.signal?.aborted;

  const emitir = (estado: EstadoCatalogo<T>) => {
    if (vivo()) onEstado(estado);
    return estado;
  };

  const entrada = await leerEntrada(opts, version, emitirMetrica);
  if (!vivo()) return { items: [], source: "cache", stale: false, revalidating: false, fallback: false, aviso: null };

  if (entrada && entradaFresca(entrada, now())) {
    emitirMetrica({ name: "catalogCacheHit", key: opts.key, reason: "fresh" });
    emitirMetrica({ name: "catalogLoadMs", key: opts.key, value: now() - inicio, reason: "cache" });
    return emitir({
      items: entrada.items,
      source: "cache",
      stale: false,
      revalidating: false,
      fallback: false,
      aviso: null,
    });
  }

  if (entrada) {
    emitirMetrica({ name: "catalogCacheHit", key: opts.key, reason: "stale" });
    emitirMetrica({ name: "catalogLoadMs", key: opts.key, value: now() - inicio, reason: "cache" });
    emitir({
      items: entrada.items,
      source: "cache",
      stale: true,
      revalidating: true,
      fallback: false,
      aviso: null,
    });
    try {
      const items = await descargarCompartido(opts);
      await guardarEntrada(opts, items, now(), ttlMs, version);
      emitirMetrica({ name: "catalogRevalidated", key: opts.key });
      emitirMetrica({ name: "catalogLoadMs", key: opts.key, value: now() - inicio, reason: "network" });
      return emitir({
        items,
        source: "network",
        stale: false,
        revalidating: false,
        fallback: false,
        aviso: null,
      });
    } catch (error) {
      if (esAbort(error) || !vivo()) {
        return { items: entrada.items, source: "cache", stale: true, revalidating: false, fallback: false, aviso: null };
      }
      emitirMetrica({ name: "catalogFallback", key: opts.key, reason: "revalidate-failed" });
      return emitir({
        items: entrada.items,
        source: "cache",
        stale: true,
        revalidating: false,
        fallback: true,
        aviso: AVISO_FALLBACK_CATALOGO,
      });
    }
  }

  const items = await descargarCompartido(opts);
  await guardarEntrada(opts, items, now(), ttlMs, version);
  emitirMetrica({ name: "catalogLoadMs", key: opts.key, value: now() - inicio, reason: "network" });
  return emitir({
    items,
    source: "network",
    stale: false,
    revalidating: false,
    fallback: false,
    aviso: null,
  });
}

/**
 * Serializa selecciones de un mismo combobox: la última clave activa gana.
 * Una emisión antigua (Madrid) nunca pisa la activa (Valencia), aunque venga de cache.
 */
export function crearSelectorCatalogo<T>() {
  let claveActiva: string | null = null;
  let controller: AbortController | null = null;

  return {
    claveActual(): string | null {
      return claveActiva;
    },
    cancelar() {
      controller?.abort();
      controller = null;
      claveActiva = null;
    },
    async seleccionar(
      opts: Omit<OpcionesCargaCatalogo<T>, "signal">,
      onEstado: (estado: EstadoCatalogo<T>) => void
    ): Promise<EstadoCatalogo<T> | null> {
      controller?.abort();
      const propio = new AbortController();
      controller = propio;
      claveActiva = opts.key;
      try {
        const final = await cargarCatalogo({ ...opts, signal: propio.signal }, (estado) => {
          if (claveActiva === opts.key && !propio.signal.aborted) onEstado(estado);
        });
        return claveActiva === opts.key && !propio.signal.aborted ? final : null;
      } catch (error) {
        if (claveActiva !== opts.key || propio.signal.aborted || esAbort(error)) return null;
        throw error;
      }
    },
  };
}

export type SelectorCatalogo<T> = ReturnType<typeof crearSelectorCatalogo<T>>;
