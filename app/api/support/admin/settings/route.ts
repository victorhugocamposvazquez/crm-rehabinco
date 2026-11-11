import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUsuarioSesionSoporte } from "@/lib/support/service";
import type { SupportSettingsRow } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user || !user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Solo superadministrador." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Partial<SupportSettingsRow> | null;
  const projectKey = (body?.project_key || "").trim().toLowerCase();
  if (!projectKey) {
    return NextResponse.json({ ok: false, error: "Falta project_key." }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const patch: Record<string, unknown> = {
    project_key: projectKey,
    updated_by: user.id,
    updated_at: ahora,
  };

  if (typeof body?.empresa_nombre === "string" && body.empresa_nombre.trim()) {
    patch.empresa_nombre = body.empresa_nombre.trim();
  }
  if (body?.estado_adhesion && ["pendiente", "aceptada", "rechazada", "suspendida"].includes(body.estado_adhesion)) {
    patch.estado_adhesion = body.estado_adhesion;
    if (body.estado_adhesion === "aceptada") {
      patch.aceptada_en = ahora;
      patch.aceptada_por = user.id;
    }
  }
  if (typeof body?.plan_activo === "boolean") {
    patch.plan_activo = body.plan_activo;
  }
  if (typeof body?.plan_nombre === "string") {
    patch.plan_nombre = body.plan_nombre.trim() || "Plan manual";
  }
  if (body?.plan_vence_en !== undefined) {
    patch.plan_vence_en = body.plan_vence_en ? body.plan_vence_en : null;
  }
  if (
    body?.solver_provider &&
    ["manual", "solo_triaje_ia", "cursor_cloud", "github_issue", "webhook_externo"].includes(body.solver_provider)
  ) {
    patch.solver_provider = body.solver_provider;
  }
  if (body?.solver_webhook_url !== undefined) {
    patch.solver_webhook_url = body.solver_webhook_url?.trim() || null;
  }
  if (body?.cursor_model && ["composer-2.5", "auto"].includes(body.cursor_model)) {
    patch.cursor_model = body.cursor_model;
  }
  if (typeof body?.auto_merge_enabled === "boolean") {
    patch.auto_merge_enabled = body.auto_merge_enabled;
  }
  if (typeof body?.max_agent_runs_per_week === "number" && Number.isFinite(body.max_agent_runs_per_week)) {
    patch.max_agent_runs_per_week = Math.max(0, Math.min(500, Math.round(body.max_agent_runs_per_week)));
  }
  if (body?.support_inbox_email !== undefined) {
    patch.support_inbox_email = body.support_inbox_email?.trim() || null;
  }
  if (body?.brevo_sender_email !== undefined) {
    patch.brevo_sender_email = body.brevo_sender_email?.trim() || null;
  }
  if (typeof body?.brevo_sender_name === "string" && body.brevo_sender_name.trim()) {
    patch.brevo_sender_name = body.brevo_sender_name.trim();
  }
  if (typeof body?.notify_admin_on_new === "boolean") {
    patch.notify_admin_on_new = body.notify_admin_on_new;
  }
  if (typeof body?.notify_user_on_updates === "boolean") {
    patch.notify_user_on_updates = body.notify_user_on_updates;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_settings")
    .upsert(patch, { onConflict: "project_key" })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings: data });
}
