import { chromium, type Browser, type BrowserContext } from "playwright";
import type { FetchResult } from "./http.js";
import { sesionPortal } from "./session.js";

let browser: Browser | null = null;
const contextos = new Map<string, BrowserContext>();

async function browserCompartido(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

export async function fetchBrowser(
  portalId: string,
  url: string,
  opts: { proxyUrl?: string; referer?: string; timeoutMs?: number }
): Promise<FetchResult> {
  let ctx = contextos.get(portalId);
  if (!ctx) {
    const sesion = sesionPortal(portalId);
    ctx = await (await browserCompartido()).newContext({
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      userAgent: sesion.userAgent,
      proxy: opts.proxyUrl ? { server: opts.proxyUrl } : undefined,
    });
    contextos.set(portalId, ctx);
  }
  const page = await ctx.newPage();
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: opts.timeoutMs ?? 45_000,
      referer: opts.referer,
    });
    const body = await page.content();
    const status = response?.status() ?? 0;
    const headers: Record<string, string> = { ...(response?.headers() ?? {}) };
    return { status, body, headers, bytes: Buffer.byteLength(body) };
  } finally {
    await page.close();
  }
}
