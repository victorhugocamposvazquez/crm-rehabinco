import { fetch, ProxyAgent } from "undici";
import type { PortalAdapter } from "../adapters/types.js";
import { actualizarCookies, cookieHeader, sesionPortal } from "./session.js";

export type FetchResult = {
  status: number;
  body: string;
  headers: Record<string, string>;
  bytes: number;
};

export async function fetchPagina(
  url: string,
  opts: {
    proxyUrl?: string;
    referer?: string;
    timeoutMs?: number;
    portalId?: string;
    extraHeaders?: Record<string, string>;
  }
): Promise<FetchResult> {
  const dispatcher = opts.proxyUrl ? new ProxyAgent(opts.proxyUrl) : undefined;
  const sesion = opts.portalId ? sesionPortal(opts.portalId) : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const cookie = sesion ? cookieHeader(sesion.cookies) : undefined;
    const response = await fetch(url, {
      dispatcher,
      signal: controller.signal,
      headers: {
        "User-Agent": sesion?.userAgent ?? "Mozilla/5.0 (compatible; CRM-Crawler/1.0)",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        ...(opts.referer ? { Referer: opts.referer } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(opts.extraHeaders ?? {}),
      },
    });
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });
    if (sesion) {
      actualizarCookies(sesion.cookies, response.headers.getSetCookie?.() ?? response.headers.get("set-cookie"));
    }
    return { status: response.status, body, headers, bytes: Buffer.byteLength(body) };
  } finally {
    clearTimeout(timer);
  }
}

export function esBloqueo(adapter: PortalAdapter, res: FetchResult): boolean {
  return adapter.detectarBloqueo({ status: res.status, body: res.body, headers: res.headers });
}

export function reintentoPermitido(status: number): boolean {
  return status >= 500 || status === 0;
}

export async function fetchViaUnblocker(
  unblockerBase: string,
  url: string,
  opts: { referer?: string; timeoutMs?: number } = {}
): Promise<FetchResult> {
  const sep = unblockerBase.includes("?") ? "&" : "?";
  const target = `${unblockerBase}${sep}url=${encodeURIComponent(url)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
    });
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return { status: response.status, body, headers, bytes: Buffer.byteLength(body) };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchConRespaldo(
  adapter: PortalAdapter,
  url: string,
  opts: {
    proxyUrl?: string;
    unblockerUrl?: string;
    referer?: string;
    portalId?: string;
  }
): Promise<FetchResult> {
  const res = await fetchPagina(url, {
    ...opts,
    extraHeaders: adapter.httpHeaders,
  });
  if (
    esBloqueo(adapter, res) &&
    adapter.transportRespaldo === "unblocker" &&
    opts.unblockerUrl?.trim()
  ) {
    return fetchViaUnblocker(opts.unblockerUrl, url, { referer: opts.referer });
  }
  return res;
}
