import { createAdminClient } from "@/lib/supabase/admin";

export async function encolarJobDetalle(input: {
  portalId: string;
  url: string;
  alertaId?: string | null;
  externoId?: string;
  prioridad?: number;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crawl_jobs")
    .insert({
      tipo: "detalle",
      portal_id: input.portalId,
      alerta_id: input.alertaId ?? null,
      url: input.url,
      prioridad: input.prioridad ?? 80,
      payload: input.externoId ? { externo_id: input.externoId } : {},
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo encolar" };
  return { ok: true, jobId: data.id as string };
}
