import { avmCronAutorizado } from "@/lib/avm/cron-auth";
import { procesarJobsOnboardPendientes, runMunicipalityOnboard } from "@/lib/avm/municipality-onboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cuerpo = z
  .object({
    municipality_code: z.string().regex(/^\d{5}$/).optional(),
    process_pending: z.boolean().optional(),
    limit: z.number().int().min(1).max(5).optional(),
  })
  .strict();

/** Ejecuta onboarding F (portales, cobertura, rastreo) o drena jobs pendientes. */
export async function POST(request: Request) {
  if (!avmCronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const json = await request.json().catch(() => ({}));
  const parsed = cuerpo.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Cuerpo no válido" }, { status: 400 });
  }
  const db = createAdminClient();

  if (parsed.data.process_pending) {
    const n = await procesarJobsOnboardPendientes(db, parsed.data.limit ?? 1);
    return Response.json({ ok: true, processed: n });
  }

  const code = parsed.data.municipality_code;
  if (!code) {
    return Response.json({ ok: false, error: "Pasa municipality_code o process_pending" }, { status: 400 });
  }

  const { data: jobId, error } = await db.rpc("municipality_onboard_enqueue", { p_ine_code: code });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  await runMunicipalityOnboard(db, code, jobId == null ? undefined : String(jobId));
  return Response.json({ ok: true, job_id: jobId });
}
