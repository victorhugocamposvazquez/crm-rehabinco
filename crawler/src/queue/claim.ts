import type { SupabaseClient } from "@supabase/supabase-js";

export type CrawlJob = {
  id: string;
  tipo: "listado" | "detalle";
  portal_id: string;
  alerta_id: string | null;
  url: string;
  prioridad: number;
  estado: string;
  intentos: number;
  payload: Record<string, unknown>;
};

export async function reclamarJobs(
  supabase: SupabaseClient,
  workerId: string,
  limite: number
): Promise<CrawlJob[]> {
  const { data, error } = await supabase.rpc("crawl_reclamar_jobs", {
    p_limite: limite,
    p_worker_id: workerId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as CrawlJob[];
}

export async function finalizarJob(
  supabase: SupabaseClient,
  jobId: string,
  estado: "ok" | "error" | "bloqueado",
  patch: { resultado?: Record<string, unknown>; error?: string; bloqueado_hasta?: string }
): Promise<void> {
  await supabase
    .from("crawl_jobs")
    .update({
      estado,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resultado: patch.resultado ?? null,
      error: patch.error ?? null,
      bloqueado_hasta: patch.bloqueado_hasta ?? null,
    })
    .eq("id", jobId);
}
