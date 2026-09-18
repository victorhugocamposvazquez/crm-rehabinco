#!/usr/bin/env tsx
/** Pasada real de un portal: encola listado pág.1 y procesa un job. */
import "../src/adapters/habitaclia/index.js";
import "../src/adapters/pisos/index.js";
import "../src/adapters/milanuncios/index.js";
import "../src/adapters/fotocasa/index.js";
import { loadEnv } from "../src/env.js";
import { getSupabase } from "../src/supabase.js";
import { reclamarJobs } from "../src/queue/claim.js";
import { procesarJob } from "../src/pipeline/process-job.js";

const portal = process.argv[2];
if (!portal) {
  console.error("Uso: npm run pasada-portal -- <portal_id>");
  process.exit(1);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const supabase = getSupabase(env);

  const { data: alerta } = await supabase
    .from("captacion_alertas")
    .select("id, portal_id, municipio, provincia, operacion, tipos_inmueble, portal_params")
    .eq("portal_id", portal)
    .eq("activa", true)
    .limit(1)
    .maybeSingle();
  if (!alerta) throw new Error(`Sin alerta activa para ${portal}`);

  await supabase.from("crawl_jobs").delete().eq("estado", "pendiente");

  const { data: inserted, error: insErr } = await supabase.from("crawl_jobs").insert({
    tipo: "listado",
    portal_id: portal,
    alerta_id: alerta.id,
    url: `scheduler://${portal}/pasada/1`,
    prioridad: 99,
    payload: {
      pagina: 1,
      municipio: alerta.municipio,
      provincia: alerta.provincia,
      operacion: alerta.operacion,
      tipos_inmueble: alerta.tipos_inmueble,
      portal_params: alerta.portal_params,
    },
  }).select("id").single();
  if (insErr || !inserted) throw new Error(insErr?.message ?? "insert job");

  const jobs = await reclamarJobs(supabase, env.WORKER_ID, 5);
  const job = jobs.find((j) => j.id === inserted.id) ?? jobs.find((j) => j.portal_id === portal);
  if (!job) throw new Error("No se pudo reclamar job del portal");
  await procesarJob(supabase, job, env.PROXY_URL, env.UNBLOCKER_URL);

  const { data: run } = await supabase
    .from("crawl_runs")
    .select("estado, anuncios_vistos, anuncios_nuevos, http_status, bloqueado, error")
    .eq("job_id", job.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count } = await supabase
    .from("captacion_anuncios")
    .select("*", { count: "exact", head: true })
    .eq("portal_id", portal);

  console.log(JSON.stringify({ portal, run, total_anuncios: count ?? 0 }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
