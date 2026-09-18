#!/usr/bin/env tsx
/**
 * Sondeo de un portal: undici sin proxy, undici con proxy, Playwright con proxy.
 * No requiere adaptador registrado; --portal solo define la carpeta de fixtures.
 * Uso: npm run sondeo -- --portal habitaclia --url "https://..."
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, ProxyAgent } from "undici";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OMITIDO = "omitido (sin proxy)";

type Fila = {
  metodo: string;
  status: number;
  bytes: number;
  challenge: string;
  formato: string;
  saved?: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let portal = "habitaclia";
  let url = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--portal") portal = args[++i] ?? portal;
    if (args[i] === "--url") url = args[++i] ?? "";
  }
  if (!url) throw new Error("Falta --url");
  return { portal, url };
}

function detectarChallenge(body: string, headers: Record<string, string>): string {
  const h = Object.values(headers).join(" ").toLowerCase();
  const b = body.toLowerCase();
  if (b.includes("datadome") || h.includes("datadome")) return "DataDome";
  if (b.includes("cloudflare") || h.includes("cf-ray")) return "Cloudflare";
  if (b.includes("akamai")) return "Akamai";
  if (b.includes("perimeterx") || b.includes("_px")) return "PerimeterX";
  return "—";
}

function detectarFormato(body: string): string {
  if (body.includes("__NEXT_DATA__")) return "JSON __NEXT_DATA__";
  if (/window\.__INITIAL_/i.test(body)) return "JSON window.__INITIAL_*";
  if (body.includes("application/ld+json")) return "JSON-LD";
  if (body.includes("gml:FeatureCollection")) return "GML/XML";
  if (body.includes("<html")) return "HTML";
  return "desconocido";
}

async function undiciFetch(url: string, proxy?: string): Promise<Fila> {
  const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
  const res = await fetch(url, {
    dispatcher,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  const body = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  const saved = await guardarFixture(body, proxy ? "undici-proxy" : "undici");
  return {
    metodo: proxy ? "undici+proxy" : "undici",
    status: res.status,
    bytes: Buffer.byteLength(body),
    challenge: detectarChallenge(body, headers),
    formato: detectarFormato(body),
    saved,
  };
}

async function playwrightFetch(url: string, proxy?: string): Promise<Fila & { saved?: string }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    proxy: proxy ? { server: proxy } : undefined,
  });
  const page = await context.newPage();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const body = await page.content();
  const status = response?.status() ?? 0;
  await browser.close();
  const saved = await guardarFixture(body, "playwright-proxy");
  return {
    metodo: "playwright+proxy",
    status,
    bytes: Buffer.byteLength(body),
    challenge: detectarChallenge(body, {}),
    formato: detectarFormato(body),
    saved,
  };
}

function omitido(metodo: string): Fila {
  return { metodo, status: 0, bytes: 0, challenge: "—", formato: OMITIDO };
}

let portalGlobal = "habitaclia";

async function guardarFixture(body: string, metodo: string): Promise<string> {
  const dir = path.resolve(__dirname, "../tests/fixtures", portalGlobal);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${metodo}-${Date.now()}.html`);
  await writeFile(file, body, "utf8");
  return file;
}

async function main() {
  const { portal, url } = parseArgs();
  portalGlobal = portal;
  const proxy = process.env.PROXY_URL?.trim();

  const filas: Array<Fila & { saved?: string }> = [];
  filas.push(await undiciFetch(url));
  filas.push(proxy ? await undiciFetch(url, proxy) : omitido("undici+proxy"));
  filas.push(proxy ? await playwrightFetch(url, proxy) : omitido("playwright+proxy"));

  console.log("\n| método | status | bytes | challenge | formato |");
  console.log("|--------|--------|-------|-------------|---------|");
  for (const f of filas) {
    console.log(`| ${f.metodo} | ${f.status} | ${f.bytes} | ${f.challenge} | ${f.formato} |`);
  }
  console.log("\nFixtures en crawler/tests/fixtures/" + portal + "/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
