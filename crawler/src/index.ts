import pino from "pino";
import "./adapters/habitaclia/index.js";
import "./adapters/pisos/index.js";
import "./adapters/milanuncios/index.js";
import "./adapters/fotocasa/index.js";
import { loadEnv, tieneProxy } from "./env.js";
import { getSupabase } from "./supabase.js";
import { reclamarJobs } from "./queue/claim.js";
import { encolarListadosPendientes } from "./scheduler/zonas.js";
import { procesarJob } from "./pipeline/process-job.js";
import { ejecutarRetencionContactos } from "./retention/job.js";

const log = pino({ name: "crm-crawler" });

async function ciclo(env: ReturnType<typeof loadEnv>): Promise<void> {
  const supabase = getSupabase(env);
  const encolados = await encolarListadosPendientes(supabase);
  if (encolados > 0) log.info({ encolados }, "listados encolados");

  const jobs = await reclamarJobs(supabase, env.WORKER_ID, env.CRAWL_BATCH);
  for (const job of jobs) {
    log.info({ jobId: job.id, tipo: job.tipo, portal: job.portal_id }, "procesando job");
    await procesarJob(supabase, job, env.PROXY_URL, env.UNBLOCKER_URL);
  }

  if (new Date().getHours() === 3) {
    const n = await ejecutarRetencionContactos(supabase);
    if (n > 0) log.info({ n }, "contactos anonimizados (retención)");
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  if (!tieneProxy(env)) {
    log.info("sin proxy, conexión directa");
  }
  log.info({ worker: env.WORKER_ID, batch: env.CRAWL_BATCH }, "crawler iniciado");
  const once = process.env.CRAWL_ONCE === "1";
  do {
    try {
      await ciclo(env);
    } catch (err) {
      log.error({ err }, "error en ciclo");
    }
    if (once) break;
    await new Promise((r) => setTimeout(r, env.CRAWL_LOOP_MS));
  } while (true);
}

main().catch((err) => {
  log.fatal({ err }, "crawler detenido");
  process.exit(1);
});
