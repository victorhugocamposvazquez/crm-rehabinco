import { publicarAviso } from "@/lib/alertas/publicar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, parseRole, type Role } from "@/lib/auth/roles";
import { getSupportProjectManifest } from "./project-manifest";
import { despacharMotorResolucion } from "./solver";
import { ejecutarTriajeTicket } from "./triage";
import type {
  SupportAttachmentRef,
  SupportEstado,
  SupportSettingsRow,
  SupportSolverProviderId,
  SupportTicket,
} from "./types";

export type SupportAuthUser = {
  id: string;
  email: string | null;
  role: Role;
  isSuperadmin: boolean;
};

export async function obtenerUsuarioSesionSoporte(): Promise<SupportAuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .maybeSingle();

  const role = parseRole(profile?.role);
  return {
    id: user.id,
    email: user.email ?? profile?.email ?? null,
    role,
    isSuperadmin: isSuperAdmin(role),
  };
}

export async function obtenerOCrearAjustesProyecto(projectKey?: string): Promise<SupportSettingsRow> {
  const admin = createAdminClient();
  const manifest = getSupportProjectManifest();
  const key = (projectKey || manifest.projectKey).trim().toLowerCase();

  const { data: existente } = await admin
    .from("support_settings")
    .select("*")
    .eq("project_key", key)
    .maybeSingle();

  if (existente) {
    return existente as unknown as SupportSettingsRow;
  }

  const esPrincipal = key === "rehabinco";
  const nueva: Partial<SupportSettingsRow> & { project_key: string } = {
    project_key: key,
    empresa_nombre: esPrincipal ? "Rehabinco" : key.toUpperCase(),
    estado_adhesion: esPrincipal ? "aceptada" : "pendiente",
    plan_activo: esPrincipal,
    plan_nombre: esPrincipal ? "Soporte Activo (Manual)" : "Sin plan activo",
    solver_provider: "solo_triaje_ia",
    cursor_model: "auto",
    auto_merge_enabled: true,
    max_agent_runs_per_week: 10,
    brevo_sender_name: "Soporte CRM",
    notify_admin_on_new: true,
    notify_user_on_updates: true,
  };

  const { data: creada } = await admin
    .from("support_settings")
    .upsert(nueva, { onConflict: "project_key" })
    .select("*")
    .single();

  return (creada ?? nueva) as SupportSettingsRow;
}

export async function firmarAdjuntosMensaje(
  adjuntosRaw: unknown
): Promise<SupportAttachmentRef[]> {
  if (!Array.isArray(adjuntosRaw) || adjuntosRaw.length === 0) return [];
  const admin = createAdminClient();
  const resultado: SupportAttachmentRef[] = [];

  for (const item of adjuntosRaw) {
    if (!item || typeof item !== "object") continue;
    const ref = item as { path?: string; nombre?: string; mime?: string };
    if (!ref.path) continue;
    const { data } = await admin.storage
      .from("support-attachments")
      .createSignedUrl(ref.path, 60 * 60);
    resultado.push({
      path: ref.path,
      nombre: ref.nombre || "captura.png",
      mime: ref.mime,
      signedUrl: data?.signedUrl,
    });
  }
  return resultado;
}

export async function avisarSuperadminsPush(input: {
  clave: string;
  titulo: string;
  cuerpo: string;
  ticketId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: superadmins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "superadmin")
      .eq("activo", true);

    for (const s of superadmins ?? []) {
      await publicarAviso({
        userId: s.id,
        canal: "soporte",
        clave: `${input.clave}:${s.id}`,
        titulo: input.titulo,
        cuerpo: input.cuerpo,
        url: `/settings/soporte?ticket=${encodeURIComponent(input.ticketId)}`,
      });
    }
  } catch {
    // Nunca romper flujo principal si falla web-push
  }
}

export async function avisarUsuarioTicketPush(input: {
  userId: string;
  clave: string;
  titulo: string;
  cuerpo: string;
  ticketId: string;
}): Promise<void> {
  try {
    await publicarAviso({
      userId: input.userId,
      canal: "soporte",
      clave: input.clave,
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      url: `/soporte?ticket=${encodeURIComponent(input.ticketId)}`,
    });
  } catch {
    // Nunca romper flujo principal si falla web-push
  }
}

/**
 * Orquestación asíncrona tras crear un ticket o al lanzarlo a demanda.
 * Respeta el modo específico del ticket (ticket.solver_provider) si existe, o el global de settings.
 */
export async function procesarTicketEnSegundoPlano(
  ticketId: string,
  opts?: { forzadoPorSuperadmin?: boolean }
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: ticketRow } = await admin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticketRow) return;
    const ticket = ticketRow as unknown as SupportTicket;
    const settings = await obtenerOCrearAjustesProyecto(ticket.project_key);
    const modoEfectivo: SupportSolverProviderId =
      ticket.solver_provider ?? settings.solver_provider;

    // 1. Modo 100% manual -> directo a bandeja sin gastar ni un token
    if (modoEfectivo === "manual") {
      await admin
        .from("support_tickets")
        .update({
          estado: "en_curso_manual",
          solver_provider: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      await avisarSuperadminsPush({
        clave: `soporte:nuevo:${ticket.id}:${Date.now()}`,
        titulo: `Ticket ${ticket.codigo}`,
        cuerpo: ticket.titulo,
        ticketId: ticket.id,
      });
      return;
    }

    // 2. Ejecutar triaje IA (Prioridad #1: Cursor auto / composer-2.5)
    await admin
      .from("support_tickets")
      .update({ estado: "triaje", updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    const { data: msgs } = await admin
      .from("support_ticket_messages")
      .select("autor_tipo, cuerpo, interno")
      .eq("ticket_id", ticket.id)
      .eq("interno", false)
      .order("created_at", { ascending: true });

    const triaje = await ejecutarTriajeTicket({
      ticket,
      cursorModelPreferido: ticket.cursor_model_override ?? settings.cursor_model,
      historialReciente: (msgs ?? []).map((m) => ({ autor: m.autor_tipo, cuerpo: m.cuerpo })),
    });

    await admin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      autor_tipo: "ia",
      interno: true,
      cuerpo: `Diagnóstico (${triaje.motorUsado ?? "ia"} · ${triaje.decision} · riesgo ${triaje.riesgo}):\n${triaje.informeTecnicoInterno}`,
    });

    // Caso A: Duda funcional -> Respondemos al usuario y esperamos su confirmación
    if (triaje.decision === "responder_duda") {
      const ahora = new Date().toISOString();
      await admin.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        autor_tipo: "ia",
        interno: false,
        cuerpo: triaje.respuestaParaUsuario,
      });
      await admin
        .from("support_tickets")
        .update({
          categoria: triaje.categoria,
          riesgo: "cero",
          modulo: ticket.modulo || triaje.moduloDetectado,
          estado: "respondido_ia",
          solver_provider: modoEfectivo,
          solucion_resumen: "Respuesta orientativa automática. Pendiente de confirmación del usuario.",
          solucion_propuesta_en: ahora,
          updated_at: ahora,
        })
        .eq("id", ticket.id);

      await avisarUsuarioTicketPush({
        userId: ticket.user_id,
        clave: `soporte:ia:${ticket.id}:${Date.now()}`,
        titulo: `Respuesta en ${ticket.codigo}`,
        cuerpo: "Te hemos dejado los pasos para resolver tu consulta. Confirma si te ha servido.",
        ticketId: ticket.id,
      });
      return;
    }

    // Caso B: Propuesta de código y modoEfectivo permite motor técnico
    if (triaje.decision === "proponer_codigo" && modoEfectivo !== "solo_triaje_ia") {
      await admin.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        autor_tipo: "ia",
        interno: false,
        cuerpo: triaje.respuestaParaUsuario,
      });

      const despacho = await despacharMotorResolucion({
        ticket,
        informeTecnico: triaje.informeTecnicoInterno,
        settings,
        providerOverride: modoEfectivo,
        forzadoManualPorAdmin: opts?.forzadoPorSuperadmin,
      });

      await admin.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        autor_tipo: "agente_codigo",
        interno: true,
        cuerpo: despacho.summary,
      });

      const autoMergePermitido =
        Boolean(despacho.dispatched) &&
        settings.auto_merge_enabled &&
        triaje.autoMergeRecomendado &&
        triaje.riesgo !== "alto";

      const nuevoEstado: SupportEstado = despacho.dispatched
        ? "agente_trabajando"
        : "escalado_humano";

      await admin
        .from("support_tickets")
        .update({
          categoria: triaje.categoria,
          riesgo: triaje.riesgo,
          modulo: ticket.modulo || triaje.moduloDetectado,
          estado: nuevoEstado,
          solver_provider: despacho.provider,
          cursor_agent_id: despacho.cursorAgentId ?? ticket.cursor_agent_id,
          cursor_run_id: despacho.cursorRunId ?? ticket.cursor_run_id,
          external_issue_url: despacho.externalIssueUrl ?? ticket.external_issue_url,
          auto_merge_permitido: autoMergePermitido,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      await avisarSuperadminsPush({
        clave: `soporte:motor:${ticket.id}:${Date.now()}`,
        titulo: despacho.dispatched
          ? `${ticket.codigo} en motor (${despacho.provider})`
          : `${ticket.codigo} requiere revisión`,
        cuerpo: ticket.titulo,
        ticketId: ticket.id,
      });
      return;
    }

    // Caso C: Escalado humano o modo solo_triaje_ia en bugs/datos
    await admin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      autor_tipo: "ia",
      interno: false,
      cuerpo: triaje.respuestaParaUsuario,
    });

    await admin
      .from("support_tickets")
      .update({
        categoria: triaje.categoria,
        riesgo: triaje.riesgo,
        modulo: ticket.modulo || triaje.moduloDetectado,
        estado: "escalado_humano",
        solver_provider: modoEfectivo,
        auto_merge_permitido: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    await avisarSuperadminsPush({
      clave: `soporte:escalado:${ticket.id}:${Date.now()}`,
      titulo: `Ticket ${ticket.codigo} para revisar`,
      cuerpo: ticket.titulo,
      ticketId: ticket.id,
    });
  } catch (err) {
    try {
      const admin = createAdminClient();
      await admin
        .from("support_tickets")
        .update({
          estado: "escalado_humano",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);
      await admin.from("support_ticket_messages").insert({
        ticket_id: ticketId,
        autor_tipo: "sistema",
        interno: true,
        cuerpo: `Fallo controlado en segundo plano: ${err instanceof Error ? err.message : "Error desconocido"}`,
      });
    } catch {
      // Silencio seguro
    }
  }
}
