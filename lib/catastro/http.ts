import {
  CATASTRO_CALLEJERO_JSON,
  CATASTRO_USER_AGENT,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
} from "./constants";
import type { CatastroClientOptions, JsonValue } from "./types";

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

/** Status sintético con el que marcamos las redirecciones a OVCError (Catastro devuelve 404 ahí). */
export const CATASTRO_OVCERROR_STATUS = 502;

export class CatastroHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly url?: string
  ) {
    super(message);
    this.name = "CatastroHttpError";
  }
}

export type CatastroRequestOptions = {
  /** Sustituye el timeout por defecto del cliente para esta petición. */
  timeoutMs?: number;
};

/**
 * Catastro no devuelve códigos de error limpios: ante un fallo interno redirige a
 * `OVCError.aspx`, que responde 404 con una página HTML. Lo detectamos para no
 * confundirlo con una respuesta legítima.
 */
export function esRedireccionAErrorCatastro(response: Pick<Response, "url" | "redirected">): boolean {
  return Boolean(response.redirected) && /OVCError/i.test(response.url ?? "");
}

export function createCatastroHttp(options: CatastroClientOptions = {}) {
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map<string, CacheEntry>();
  let lastRequestAt = 0;
  let queue: Promise<void> = Promise.resolve();
  let fetches = 0;
  let cacheHits = 0;

  async function waitTurn() {
    const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
  }

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = queue.then(fn, fn);
    queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async function getJson(
    operation: string,
    params: Record<string, string | undefined>,
    requestOptions: CatastroRequestOptions = {}
  ): Promise<JsonValue> {
    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") {
        search.set(key, value);
      }
    }

    const url = `${CATASTRO_CALLEJERO_JSON}/${operation}${
      search.size > 0 ? `?${search.toString()}` : ""
    }`;

    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      cacheHits += 1;
      return cached.payload as JsonValue;
    }

    return enqueue(async () => {
      const stillFresh = cache.get(url);
      if (stillFresh && stillFresh.expiresAt > Date.now()) {
        cacheHits += 1;
        return stillFresh.payload as JsonValue;
      }

      fetches += 1;
      await waitTurn();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": CATASTRO_USER_AGENT,
          },
          signal: controller.signal,
        });

        if (esRedireccionAErrorCatastro(response)) {
          throw new CatastroHttpError(
            `Catastro ha devuelto su página de error (OVCError) en ${operation}`,
            CATASTRO_OVCERROR_STATUS,
            url
          );
        }
        if (!response.ok) {
          throw new CatastroHttpError(
            `Catastro respondió HTTP ${response.status} en ${operation}`,
            response.status,
            url
          );
        }

        const payload = (await response.json()) as JsonValue;
        if (cacheTtlMs > 0) {
          cache.set(url, { payload, expiresAt: Date.now() + cacheTtlMs });
        }
        return payload;
      } catch (error) {
        if (error instanceof CatastroHttpError) {
          console.error("[catastro]", error.message);
          throw error;
        }
        const message =
          error instanceof Error ? error.message : "Error desconocido al consultar Catastro";
        console.error("[catastro]", operation, message);
        throw new CatastroHttpError(message, undefined, url);
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async function getText(
    url: string,
    accept = "application/xml,text/xml",
    requestOptions: CatastroRequestOptions = {}
  ): Promise<string> {
    const timeoutMs = requestOptions.timeoutMs ?? defaultTimeoutMs;
    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now() && typeof cached.payload === "string") {
      cacheHits += 1;
      return cached.payload;
    }

    return enqueue(async () => {
      const stillFresh = cache.get(url);
      if (stillFresh && stillFresh.expiresAt > Date.now() && typeof stillFresh.payload === "string") {
        cacheHits += 1;
        return stillFresh.payload;
      }

      fetches += 1;
      await waitTurn();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: accept,
            "User-Agent": CATASTRO_USER_AGENT,
          },
          signal: controller.signal,
        });

        if (esRedireccionAErrorCatastro(response)) {
          throw new CatastroHttpError(
            "Catastro ha devuelto su página de error (OVCError)",
            CATASTRO_OVCERROR_STATUS,
            url
          );
        }
        if (!response.ok) {
          throw new CatastroHttpError(
            `Catastro respondió HTTP ${response.status}`,
            response.status,
            url
          );
        }

        const payload = await response.text();
        if (cacheTtlMs > 0) {
          cache.set(url, { payload, expiresAt: Date.now() + cacheTtlMs });
        }
        return payload;
      } catch (error) {
        if (error instanceof CatastroHttpError) {
          console.error("[catastro]", error.message);
          throw error;
        }
        const message =
          error instanceof Error ? error.message : "Error desconocido al consultar Catastro";
        console.error("[catastro]", message);
        throw new CatastroHttpError(message, undefined, url);
      } finally {
        clearTimeout(timer);
      }
    });
  }

  function getStats() {
    return { fetches, cacheHits };
  }

  return { getJson, getText, getStats };
}
