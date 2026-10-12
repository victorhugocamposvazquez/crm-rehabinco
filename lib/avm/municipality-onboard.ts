import type { SupabaseClient } from "@supabase/supabase-js";
import { provinciaCatastroPorCodigo, ineProvinciaDeMunicipio } from "../catastro/provincias-espana";
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

    const region = geofabrikPorProvincia(prov);
    if (jobId) {
      await logJob(db, jobId, "env_queue", { geofabrik: region, note: "Ejecutar scripts/env-load/osm.ts --region … manual o cron" });
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

/** Extracto Geofabrik por comunidad (OSM entorno). */
export function geofabrikPorProvincia(provinceCode: string): string {
  const p = provinceCode.padStart(2, "0");
  const galicia = new Set(["15", "27", "32", "36"]);
  const catalunya = new Set(["08", "17", "25", "43"]);
  const madrid = p === "28";
  const andalucia = new Set(["04", "11", "14", "18", "21", "23", "29", "41"]);
  const paisVasco = new Set(["01", "20", "48"]);
  if (galicia.has(p)) return "spain/galicia";
  if (catalunya.has(p)) return "spain/cataluna";
  if (madrid) return "spain/madrid";
  if (andalucia.has(p)) return "spain/andalucia";
  if (paisVasco.has(p)) return "spain/pais-vasco";
  if (p === "46") return "spain/valencia";
  if (p === "31") return "spain/navarra";
  const name = provinciaCatastroPorCodigo(p);
  return name ? `spain/province-${p}` : "spain";
}

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
