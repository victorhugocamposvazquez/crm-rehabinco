import type { SupabaseClient } from "@supabase/supabase-js";
import { ineProvinciaDeMunicipio } from "../catastro/provincias-espana";
import { geofabrikScopeFromProvince } from "./geofabrik";
import { dispatchAvmDataWorkflow } from "./github-dispatch";
import { rastrearMercado } from "./crawl/market-listings-crawl";
import { resolverSlugsPortal } from "./crawl/portal-slugs";

export type OnboardStep = "portal_slugs" | "coverage_check" | "crawl_first" | "env_queue";

async function logJob(db: SupabaseClient, jobId: string, msg: string, data: Record<string, unknown> = {}): Promise<void> {
  const { error } = await db.rpc("avm_job_log", { p_job_id: jobId, p_line: msg, p_data: data });
  if (error) throw new Error(error.message);
}

export async function runMunicipalityOnboard(db: SupabaseClient, ineCode: string, jobId?: string): Promise<void> {
  const code = ineCode.replace(/\D/g, "").padStart(5, "0");
  const prov = ineProvinciaDeMunicipio(code);

  if (jobId) {
    await db.from("avm_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);
  }

  try {
    const slugs = await resolverSlugsPortal(db, code);
    if (jobId) await logJob(db, jobId, "portal_slugs", { slugs });

    const { count: sections } = await db
      .from("ine_census_sections")
      .select("code", { count: "exact", head: true })
      .like("code", `${code}%`);
    const { count: cpProv } = await db
      .from("postcode_polygons")
      .select("postcode", { count: "exact", head: true })
      .like("postcode", `${prov}%`);

    const pendientes: string[] = [];
    if ((sections ?? 0) === 0) pendientes.push("secciones_censales_municipio");
    if ((cpProv ?? 0) === 0) pendientes.push("cp_poligonos_provincia");
    if (jobId) await logJob(db, jobId, "coverage_check", { sections: sections ?? 0, cpProv: cpProv ?? 0, pendientes });

    const informes = await rastrearMercado(db, { municipalityCode: code });
    if (jobId) await logJob(db, jobId, "crawl_first", { informes: informes.length });

    const region = geofabrikScopeFromProvince(prov);
    try {
      await dispatchAvmDataWorkflow({ layer: "osm", scope: region });
      if (jobId) await logJob(db, jobId, "env_queue", { geofabrik: region, github: "avm-data-load" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (jobId) await logJob(db, jobId, "env_queue", { geofabrik: region, github_error: msg });
    }

    if (jobId) {
      await db
        .from("avm_jobs")
        .update({ status: "done", finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (jobId) {
      await logJob(db, jobId, "error", { msg });
      await db
        .from("avm_jobs")
        .update({ status: "failed", error: msg, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    throw e;
  }
}

export { geofabrikScopeFromProvince as geofabrikPorProvincia } from "./geofabrik";

export async function procesarJobsOnboardPendientes(db: SupabaseClient, limit = 1): Promise<number> {
  const { data: jobs, error } = await db
    .from("avm_jobs")
    .select("id, ine_code")
    .eq("job_type", "municipality_onboard")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  let n = 0;
  for (const job of jobs ?? []) {
    if (!job.ine_code) continue;
    await runMunicipalityOnboard(db, String(job.ine_code), String(job.id));
    n += 1;
  }
  return n;
}
