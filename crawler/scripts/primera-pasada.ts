#!/usr/bin/env tsx
/** Una pasada del worker (requiere SUPABASE_SERVICE_ROLE_KEY en crawler/.env). */
import "../src/adapters/habitaclia/index.js";
import "../src/adapters/pisos/index.js";
import "../src/adapters/milanuncios/index.js";
import "../src/adapters/fotocasa/index.js";
import { loadEnv } from "../src/env.js";
import { getSupabase } from "../src/supabase.js";
import { encolarListadosPendientes } from "../src/scheduler/zonas.js";
import { reclamarJobs, finalizarJob } from "../src/queue/claim.js";
import { procesarJob } from "../src/pipeline/process-job.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const supabase = getSupabase(env);
  await encolarListadosPendientes(supabase);
  const limite = Number(process.env.CRAWL_BATCH ?? 1);
  const jobs = await reclamarJobs(supabase, env.WORKER_ID, limite);
  if (jobs.length === 0) {
    console.log("Sin jobs pendientes");
    return;
  }
  for (const job of jobs) {
    await procesarJob(supabase, job, env.PROXY_URL, env.UNBLOCKER_URL);
  }
  const { count } = await supabase
    .from("captacion_anuncios")
    .select("*", { count: "exact", head: true })
    .eq("portal_id", "habitaclia");
  console.log(JSON.stringify({ jobs: jobs.length, habitaclia_anuncios: count ?? 0 }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
