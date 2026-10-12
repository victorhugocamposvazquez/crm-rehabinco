import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../env-load/_shared";

export async function withAvmDataJob<T>(
  job: string,
  scope: string,
  run: () => Promise<{ rows: number }>,
  db?: SupabaseClient,
): Promise<{ rows: number; jobId: string }> {
  const client = db ?? (await adminClient());
  const { data: jobId, error: startErr } = await client.rpc("avm_data_job_start", {
    p_job: job,
    p_scope: scope,
  });
  if (startErr || !jobId) throw new Error(startErr?.message ?? "No se ha creado avm_jobs");

  try {
    const { rows } = await run();
    const { error: finErr } = await client.rpc("avm_data_job_finish", {
      p_id: jobId,
      p_rows: rows,
      p_error: null,
    });
    if (finErr) throw new Error(finErr.message);
    return { rows, jobId: String(jobId) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await client.rpc("avm_data_job_finish", { p_id: jobId, p_rows: null, p_error: msg });
    throw e;
  }
}
