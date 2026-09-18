import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

function cargarDotEnv(): void {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(dir, "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PROXY_URL: z.string().optional(),
  UNBLOCKER_URL: z.string().optional(),
  WORKER_ID: z.string().default("worker-1"),
  TZ: z.string().default("Europe/Madrid"),
  CRAWL_LOOP_MS: z.coerce.number().default(5000),
  CRAWL_BATCH: z.coerce.number().default(1),
});

export type CrawlerEnv = Omit<z.infer<typeof schema>, "SUPABASE_URL"> & {
  NEXT_PUBLIC_SUPABASE_URL: string;
};

export function tieneProxy(env: Pick<CrawlerEnv, "PROXY_URL">): boolean {
  return Boolean(env.PROXY_URL?.trim());
}

export function aplicarLimitesSinProxy(env: CrawlerEnv): CrawlerEnv {
  if (tieneProxy(env)) return env;
  return { ...env, CRAWL_BATCH: 1 };
}

export function loadEnv(): CrawlerEnv {
  cargarDotEnv();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const proxyUrl = process.env.PROXY_URL?.trim() || undefined;
  const unblockerUrl = process.env.UNBLOCKER_URL?.trim() || undefined;
  const parsed = schema.safeParse({
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    PROXY_URL: proxyUrl,
    UNBLOCKER_URL: unblockerUrl,
  });
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas: ${parsed.error.message}`);
  }
  if (!parsed.data.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL");
  }
  const { SUPABASE_URL: _omit, ...rest } = parsed.data;
  return aplicarLimitesSinProxy(rest as CrawlerEnv);
}
