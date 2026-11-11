import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarEventoTicketPorCorreo } from "@/lib/support/brevo";
import { evaluarCandadosDiff, verificarFirmaHmac } from "@/lib/support/guardrails";
import {
  avisarSuperadminsPush,
  avisarUsuarioTicketPush,
  obtenerOCrearAjustesProyecto,
} from "@/lib/support/service";
import { esTicketAbierto, type SupportTicket } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubGatePayload = {
  action: "verify_gate" | "report_automerge" | "report_retained";
  ticketId: string;
  prNumber: number;
  prUrl: string;
  branch?: string;
  previewUrl?: string;
  files?: string[];
  additions?: number;
  deletions?: number;
  reason?: string;
};

export async function POST(request: Request) {
  const secret = process.env.SUPPORT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "SUPPORT_WEBHOOK_SECRET no configurado." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-support-signature");
  if (!verificarFirmaHmac(rawBody, sig, secret)) {
    return NextResponse.json({ ok: false, error: "Firma HMAC inválida." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as GithubGatePayload;
  if (!payload?.ticketId) {
    return NextResponse.json({ ok: false, error: "Falta ticketId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ticketRow } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", payload.ticketId)
    .maybeSingle();

  if (!ticketRow) {
    return NextResponse.json({ ok: false, allowAutoMerge: false, reason: "Ticket inexistente." }, { status: 404 });
  }

  const ticket = ticketRow as unknown as SupportTicket;
  const settings = await obtenerOCrearAjustesProyecto(ticket.project_key);
  const ahora = new Date().toISOString();

  // Candado 4 + verificación server-side de Candados 1 y 2
  if (payload.action === "verify_gate") {
    const diffCheck = evaluarCandadosDiff({
      files: payload.files ?? [],
      additions: payload.additions ?? 0,
      deletions: payload.deletions ?? 0,
    });

    const allow =
      esTicketAbierto(ticket.estado) &&
      settings.auto_merge_enabled &&
      ticket.auto_merge_permitido &&
      diffCheck.allowed;

    const motivos = [
      ...(!esTicketAbierto(ticket.estado) ? ["El ticket ya no está abierto."] : []),
      ...(!settings.auto_merge_enabled ? ["Auto-merge desactivado globalmente en Ajustes."] : []),
      ...(!ticket.auto_merge_permitido ? ["Este ticket requiere aprobación manual."] : []),
      ...diffCheck.reasons,
    ];

    await admin
      .from("support_tickets")
      .update({
        github_pr_number: payload.prNumber,
        github_pr_url: payload.prUrl,
        github_branch: payload.branch ?? ticket.github_branch,
        vercel_preview_url: payload.previewUrl ?? ticket.vercel_preview_url,
        updated_at: ahora,
      })
      .eq("id", ticket.id);

    return NextResponse.json({
      ok: true,
      allowAutoMerge: allow,
      reasons: motivos,
    });
  }

  // PR auto-fusionado tras superar los 4 candados -> pasa a 'pendiente_confirmacion' para que el usuario valide
  if (payload.action === "report_automerge") {
    const msgUsuario =
      "Hemos desplegado una corrección automática para esta incidencia. Cuando puedas, compruébalo en el CRM y pulsa «Sí, está solucionado» en tu panel de soporte (o avísanos si sigue pasando).";

    await admin.from("support_ticket_messages").insert([
      {
        ticket_id: ticket.id,
        autor_tipo: "sistema",
        interno: true,
        cuerpo: `PR #${payload.prNumber} superó los 4 candados y se fusionó en main (${payload.prUrl}). Esperando confirmación del usuario.`,
      },
      {
        ticket_id: ticket.id,
        autor_tipo: "agente_codigo",
        interno: false,
        cuerpo: msgUsuario,
      },
    ]);

    const { data: actualizado } = await admin
      .from("support_tickets")
      .update({
        estado: "pendiente_confirmacion",
        github_pr_number: payload.prNumber,
        github_pr_url: payload.prUrl,
        github_branch: payload.branch ?? ticket.github_branch,
        solucion_resumen: `Corrección desplegada automáticamente (PR #${payload.prNumber}).`,
        solucion_propuesta_en: ahora,
        auto_merge_permitido: false,
        updated_at: ahora,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (actualizado) {
      await avisarUsuarioTicketPush({
        userId: actualizado.user_id,
        clave: `soporte:automerge:${actualizado.id}:${payload.prNumber}`,
        titulo: `Solución lista en ${actualizado.codigo}`,
        cuerpo: "Comprueba si ya funciona y confírmalo en tu panel.",
        ticketId: actualizado.id,
      });
      await notificarEventoTicketPorCorreo({
        evento: "solucion_propuesta",
        ticket: actualizado as unknown as SupportTicket,
        mensajeAdicional: msgUsuario,
        settings,
      });
    }

    return NextResponse.json({ ok: true });
  }

  // PR retenido por tocar rutas protegidas, tamaño o revisión requerida -> avisa a superadmin para 1 clic
  if (payload.action === "report_retained") {
    const motivo = payload.reason || "Requiere validación de superadministrador.";
    await admin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      autor_tipo: "sistema",
      interno: true,
      cuerpo: `PR #${payload.prNumber} listo para revisar en 1 clic (${payload.prUrl}). Motivo de retención: ${motivo}`,
    });

    const { data: actualizado } = await admin
      .from("support_tickets")
      .update({
        estado: "pr_revision",
        github_pr_number: payload.prNumber,
        github_pr_url: payload.prUrl,
        github_branch: payload.branch ?? ticket.github_branch,
        vercel_preview_url: payload.previewUrl ?? ticket.vercel_preview_url,
        updated_at: ahora,
      })
      .eq("id", ticket.id)
      .select("*")
      .single();

    if (actualizado) {
      await avisarSuperadminsPush({
        clave: `soporte:pr:${actualizado.id}:${payload.prNumber}`,
        titulo: `PR #${payload.prNumber} listo en ${actualizado.codigo}`,
        cuerpo: motivo.slice(0, 120),
        ticketId: actualizado.id,
      });
      await notificarEventoTicketPorCorreo({
        evento: "escalado_soporte",
        ticket: actualizado as unknown as SupportTicket,
        mensajeAdicional: `Hay un Pull Request preparado (${payload.prUrl}).\nMotivo de revisión manual: ${motivo}`,
        settings,
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
