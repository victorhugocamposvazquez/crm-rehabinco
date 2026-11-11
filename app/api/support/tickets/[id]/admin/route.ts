import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarEventoTicketPorCorreo } from "@/lib/support/brevo";
import {
  avisarUsuarioTicketPush,
  obtenerOCrearAjustesProyecto,
  obtenerUsuarioSesionSoporte,
} from "@/lib/support/service";
import {
  despacharMotorResolucion,
  fusionarPullRequestGithub,
  reanudarCursorCloudAgent,
} from "@/lib/support/solver";
import type {
  SupportEstado,
  SupportSolverProviderId,
  SupportTicket,
} from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user || !user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Solo superadministrador." }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: ticketRow } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ticketRow) {
    return NextResponse.json({ ok: false, error: "Ticket no encontrado." }, { status: 404 });
  }

  const ticket = ticketRow as unknown as SupportTicket;
  const settings = await obtenerOCrearAjustesProyecto(ticket.project_key);
  const body = (await request.json().catch(() => null)) as {
    accion?: "cambiar_estado" | "lanzar_motor" | "reanudar_agente" | "aprobar_fusionar_pr";
    estado?: SupportEstado;
    resumenSolucion?: string;
    notificarUsuario?: boolean;
    provider?: SupportSolverProviderId;
    instrucciones?: string;
  } | null;

  const ahora = new Date().toISOString();

  // 1. Control manual total de estados (incluido marcar solución lista o forzar resuelto/cerrado)
  if (body?.accion === "cambiar_estado" && body.estado) {
    const estado = body.estado;
    const resumen = (body.resumenSolucion || "").trim();
    const patch: Record<string, unknown> = {
      estado,
      updated_at: ahora,
    };

    if (estado === "pendiente_confirmacion") {
      patch.solucion_propuesta_en = ahora;
      patch.solucion_resumen = resumen || "Solución aplicada manualmente por el equipo de soporte.";
      patch.auto_merge_permitido = false;
    } else if (estado === "resuelto" || estado === "cerrado") {
      patch.resuelto_en = ahora;
      patch.resuelto_por = "superadmin";
      patch.auto_merge_permitido = false;
      if (resumen) patch.solucion_resumen = resumen;
    }

    const { data: actualizado, error } = await admin
      .from("support_tickets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !actualizado) {
      return NextResponse.json({ ok: false, error: error?.message || "No se pudo cambiar el estado." }, { status: 500 });
    }

    if (resumen && body.notificarUsuario !== false) {
      await admin.from("support_ticket_messages").insert({
        ticket_id: id,
        user_id: user.id,
        autor_tipo: "superadmin",
        interno: false,
        cuerpo: resumen,
      });
    } else {
      await admin.from("support_ticket_messages").insert({
        ticket_id: id,
        user_id: user.id,
        autor_tipo: "sistema",
        interno: true,
        cuerpo: `Estado cambiado manualmente a «${estado}».`,
      });
    }

    if (body.notificarUsuario !== false && (estado === "pendiente_confirmacion" || resumen)) {
      waitUntil(
        (async () => {
          await avisarUsuarioTicketPush({
            userId: actualizado.user_id,
            clave: `soporte:estado:${actualizado.id}:${Date.now()}`,
            titulo:
              estado === "pendiente_confirmacion"
                ? `Solución lista en ${actualizado.codigo}`
                : `Actualización en ${actualizado.codigo}`,
            cuerpo:
              resumen ||
              "Hemos aplicado una solución. Entra a tu panel para confirmar si ya te funciona.",
            ticketId: actualizado.id,
          });
          await notificarEventoTicketPorCorreo({
            evento: estado === "pendiente_confirmacion" ? "solucion_propuesta" : "respuesta_soporte",
            ticket: actualizado as unknown as SupportTicket,
            mensajeAdicional:
              resumen ||
              "Hemos aplicado una solución a tu consulta. Por favor, comprueba si ya funciona y confírmalo en tu panel.",
            settings,
          });
        })()
      );
    }

    return NextResponse.json({ ok: true, ticket: actualizado });
  }

  // 2. Lanzar cualquier motor de resolución bajo demanda desde la consola
  if (body?.accion === "lanzar_motor") {
    const provider = body.provider || (settings.solver_provider === "manual" || settings.solver_provider === "solo_triaje_ia" ? "cursor_cloud" : settings.solver_provider);
    const despacho = await despacharMotorResolucion({
      ticket,
      informeTecnico: ticket.solucion_resumen || ticket.descripcion,
      settings,
      providerOverride: provider,
      forzadoManualPorAdmin: true,
    });

    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "agente_codigo",
      interno: true,
      cuerpo: `[Lanzado manualmente por superadmin] ${despacho.summary}`,
    });

    if (!despacho.dispatched) {
      return NextResponse.json(
        { ok: false, error: despacho.error || despacho.summary },
        { status: 400 }
      );
    }

    const { data: actualizado } = await admin
      .from("support_tickets")
      .update({
        estado: "agente_trabajando",
        solver_provider: despacho.provider,
        cursor_agent_id: despacho.cursorAgentId ?? ticket.cursor_agent_id,
        cursor_run_id: despacho.cursorRunId ?? ticket.cursor_run_id,
        external_issue_url: despacho.externalIssueUrl ?? ticket.external_issue_url,
        updated_at: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();

    return NextResponse.json({
      ok: true,
      ticket: actualizado ?? ticket,
      detalle: despacho.summary,
    });
  }

  // 3. Reanudar Cursor Cloud Agent existente con nuevas indicaciones
  if (body?.accion === "reanudar_agente") {
    if (!ticket.cursor_agent_id) {
      return NextResponse.json(
        { ok: false, error: "Este ticket no tiene un agente de Cursor asociado." },
        { status: 400 }
      );
    }
    const instrucciones = (body.instrucciones || "").trim();
    if (!instrucciones) {
      return NextResponse.json({ ok: false, error: "Escribe las instrucciones para el agente." }, { status: 400 });
    }

    const res = await reanudarCursorCloudAgent({
      cursorAgentId: ticket.cursor_agent_id,
      instrucciones,
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error || "Fallo al reanudar agente." }, { status: 500 });
    }

    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "agente_cursor",
      interno: true,
      cuerpo: `Instrucciones enviadas al agente (${ticket.cursor_agent_id}):\n${instrucciones}`,
    });

    const { data: actualizado } = await admin
      .from("support_tickets")
      .update({
        estado: "agente_trabajando",
        cursor_run_id: res.runId ?? ticket.cursor_run_id,
        updated_at: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();

    return NextResponse.json({
      ok: true,
      ticket: actualizado ?? ticket,
      detalle: `Agente reanudado (run ${res.runId ?? "activo"}).`,
    });
  }

  // 4. Aprobar y fusionar PR en 1 clic -> Pasa a pendiente_confirmacion (nunca resuelto sin validar el usuario)
  if (body?.accion === "aprobar_fusionar_pr") {
    if (!ticket.github_pr_number) {
      return NextResponse.json(
        { ok: false, error: "Este ticket no tiene un número de PR registrado." },
        { status: 400 }
      );
    }

    const merge = await fusionarPullRequestGithub(ticket.github_pr_number);
    if (!merge.ok) {
      return NextResponse.json({ ok: false, error: merge.error || "No se pudo fusionar el PR." }, { status: 500 });
    }

    const notaPublica =
      "Hemos desplegado una corrección para esta incidencia. Cuando puedas, compruébalo y confírmanos desde tu panel si ya funciona correctamente.";

    await admin.from("support_ticket_messages").insert([
      {
        ticket_id: id,
        user_id: user.id,
        autor_tipo: "sistema",
        interno: true,
        cuerpo: `PR #${ticket.github_pr_number} aprobado y fusionado en main (${merge.sha ?? "squash"}).`,
      },
      {
        ticket_id: id,
        user_id: user.id,
        autor_tipo: "superadmin",
        interno: false,
        cuerpo: notaPublica,
      },
    ]);

    const { data: actualizado } = await admin
      .from("support_tickets")
      .update({
        estado: "pendiente_confirmacion",
        solucion_resumen: `Corrección desplegada (PR #${ticket.github_pr_number}).`,
        solucion_propuesta_en: ahora,
        auto_merge_permitido: false,
        updated_at: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (actualizado) {
      waitUntil(
        (async () => {
          await avisarUsuarioTicketPush({
            userId: actualizado.user_id,
            clave: `soporte:prmerge:${actualizado.id}`,
            titulo: `Solución desplegada en ${actualizado.codigo}`,
            cuerpo: "Comprueba si ya funciona y confírmalo en tu panel.",
            ticketId: actualizado.id,
          });
          await notificarEventoTicketPorCorreo({
            evento: "solucion_propuesta",
            ticket: actualizado as unknown as SupportTicket,
            mensajeAdicional: notaPublica,
            settings,
          });
        })()
      );
    }

    return NextResponse.json({
      ok: true,
      ticket: actualizado ?? ticket,
      detalle: `PR #${ticket.github_pr_number} fusionado en main.`,
    });
  }

  return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
}
