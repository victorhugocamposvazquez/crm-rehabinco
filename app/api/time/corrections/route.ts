import { escribirAudit, mapPunch, sesionFichaje } from "@/lib/time/server";
import type { PunchType } from "@/lib/time/types";

export const runtime = "nodejs";

const TIPOS = new Set<PunchType>(["in", "out", "pause_start", "pause_end"]);

export async function GET() {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });

  let q = sesion.supabase
    .from("fichaje_corrections")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(100);
  if (!sesion.admin) q = q.eq("user_id", sesion.userId);

  const { data, error } = await q;
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, corrections: data ?? [] });
}

export async function POST(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    date?: string;
    type?: string;
    proposedAt?: string;
    reason?: string;
    note?: string | null;
    originalPunchId?: string | null;
    resolveNow?: boolean;
  } | null;

  const type = body?.type as PunchType | undefined;
  if (!body?.date || !type || !TIPOS.has(type) || !body.proposedAt || !body.reason?.trim()) {
    return Response.json({ ok: false, error: "Faltan datos de la corrección." }, { status: 400 });
  }

  const targetUser = sesion.admin && body.userId ? body.userId : sesion.userId;
  const resolveNow = Boolean(sesion.admin && body.resolveNow);

  const { data: corr, error } = await sesion.supabase
    .from("fichaje_corrections")
    .insert({
      user_id: targetUser,
      date: body.date,
      type,
      original_punch_id: body.originalPunchId ?? null,
      proposed_at: body.proposedAt,
      reason: body.reason.trim(),
      note: body.note?.trim() || null,
      status: resolveNow ? "approved" : "pending",
      requested_by: sesion.userId,
      resolved_by: resolveNow ? sesion.userId : null,
      resolved_at: resolveNow ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  if (resolveNow && corr) {
    const result = await aplicarCorreccion(sesion, corr.id as string, true);
    if (!result.ok) return Response.json(result, { status: 500 });
    return Response.json({ ok: true, correction: result.correction, punch: result.punch });
  }

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: "solicitud",
    detail: `Corrección ${type} ${body.date} → ${body.proposedAt}`,
    origin: "pwa",
  });

  return Response.json({ ok: true, correction: corr });
}

export async function PATCH(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion?.admin) return Response.json({ ok: false, error: "Solo administración." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    decision?: "approved" | "rejected";
  } | null;

  if (!body?.id || (body.decision !== "approved" && body.decision !== "rejected")) {
    return Response.json({ ok: false, error: "Decisión no válida." }, { status: 400 });
  }

  if (body.decision === "rejected") {
    const { data, error } = await sesion.supabase
      .from("fichaje_corrections")
      .update({
        status: "rejected",
        resolved_by: sesion.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    await escribirAudit(sesion.supabase, {
      actorId: sesion.userId,
      actorLabel: sesion.nombre,
      action: "rechazada",
      detail: `Corrección ${body.id} rechazada`,
      origin: "panel-admin",
    });
    return Response.json({ ok: true, correction: data });
  }

  const result = await aplicarCorreccion(sesion, body.id, false);
  if (!result.ok) return Response.json(result, { status: 500 });
  return Response.json({ ok: true, correction: result.correction, punch: result.punch });
}

async function aplicarCorreccion(
  sesion: NonNullable<Awaited<ReturnType<typeof sesionFichaje>>>,
  correctionId: string,
  alreadyApproved: boolean
) {
  const { data: corr, error } = await sesion.supabase
    .from("fichaje_corrections")
    .select("*")
    .eq("id", correctionId)
    .maybeSingle();
  if (error || !corr) return { ok: false as const, error: error?.message ?? "Corrección no encontrada." };
  if (!alreadyApproved && corr.status !== "pending") {
    return { ok: false as const, error: "La corrección ya está resuelta." };
  }

  const { data: punch, error: punchErr } = await sesion.supabase
    .from("fichaje_punches")
    .insert({
      user_id: corr.user_id,
      type: corr.type,
      at: corr.proposed_at,
      mode: "office",
      source: `correction:${corr.id}`,
      sequence_ok: true,
    })
    .select("*")
    .single();
  if (punchErr || !punch) return { ok: false as const, error: punchErr?.message ?? "No se pudo crear el punch." };

  if (corr.original_punch_id) {
    await sesion.supabase
      .from("fichaje_punches")
      .update({ superseded_by: punch.id })
      .eq("id", corr.original_punch_id);
  }

  const { data: updated, error: updErr } = await sesion.supabase
    .from("fichaje_corrections")
    .update({
      status: "approved",
      resolved_by: sesion.userId,
      resolved_at: new Date().toISOString(),
      resulting_punch_id: punch.id,
    })
    .eq("id", correctionId)
    .select("*")
    .single();
  if (updErr) return { ok: false as const, error: updErr.message };

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: "aprobada",
    detail: `Corrección ${correctionId}: ${corr.type} → ${corr.proposed_at}`,
    origin: "panel-admin",
  });

  return {
    ok: true as const,
    correction: updated,
    punch: mapPunch(punch as Record<string, unknown>),
  };
}
