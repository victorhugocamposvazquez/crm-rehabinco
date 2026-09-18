#!/usr/bin/env tsx
/** Procesa jobs tipo=detalle pendientes (pisos.com, milanuncios, …). */
import "../src/adapters/habitaclia/index.js";
import "../src/adapters/pisos/index.js";
import "../src/adapters/milanuncios/index.js";
import "../src/adapters/fotocasa/index.js";
import "../src/adapters/wallapop/index.js";
import { loadEnv } from "../src/env.js";
import { getSupabase } from "../src/supabase.js";
import { reclamarJobs } from "../src/queue/claim.js";
import { procesarJob } from "../src/pipeline/process-job.js";

const portales = process.argv.slice(2);
const maxJobs = Number(process.env.MAX_DETALLE_JOBS ?? 50);

async function main(): Promise<void> {
  const env = loadEnv();
  const supabase = getSupabase(env);
  let procesados = 0;

  while (procesados < maxJobs) {
    const jobs = await reclamarJobs(supabase, env.WORKER_ID, 5);
    const pendientes = jobs.filter(
      (j) =>
        j.tipo === "detalle" &&
        (portales.length === 0 || portales.includes(j.portal_id))
    );
    if (pendientes.length === 0) break;
    for (const job of pendientes) {
      await procesarJob(supabase, job, env.PROXY_URL, env.UNBLOCKER_URL);
      procesados += 1;
      if (procesados >= maxJobs) break;
    }
  }

  const filtro = portales.length ? portales : ["pisos.com", "milanuncios"];
  const rows: Array<Record<string, unknown>> = [];
  for (const portal of filtro) {
    const { data: anuncios } = await supabase
      .from("captacion_anuncios")
      .select("contacto_telefono, contacto_clave, desaparecido_en, municipio")
      .eq("portal_id", portal)
      .is("desaparecido_en", null);
    const activos = anuncios ?? [];
    const coruna = activos.filter((a) => String(a.municipio ?? "").includes("Coru"));
    const conTel = coruna.filter((a) => a.contacto_telefono);
    const sinTel = coruna.filter((a) => !a.contacto_telefono);
    const claves = new Set(coruna.map((a) => a.contacto_clave).filter(Boolean));
    const porTel = [...claves].filter((c) => String(c).startsWith("tel:")).length;
    const porNom = [...claves].filter((c) => String(c).startsWith("nom:")).length;
    rows.push({
      portal,
      activos: coruna.length,
      con_telefono: conTel.length,
      sin_telefono: sinTel.length,
      contactos_tel: porTel,
      contactos_nom: porNom,
    });
  }

  console.log(JSON.stringify({ procesados, tabla: rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
