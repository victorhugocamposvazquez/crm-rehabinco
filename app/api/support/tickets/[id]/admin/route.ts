import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  avisarUsuarioTicketPush,
  obtenerOCrearAjustesProyecto,
  obtenerUsuarioSesionSoporte,
  procesarTicketEnSegundoPlano,
} from "@/lib/support/service";
import {
  despacharMotorResolucion,
  fusionarPullRequestGithub,
  reanudarCursorCloudAgent,
} from "@/lib/support/solver";
import {
  SUPPORT_SOLVER_LABELS,
  type SupportEstado,
  type SupportSolverProviderId,
  type SupportTicket,
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
    accion?:
      | "cambiar_estado"
      | "configurar_modo_ticket"
      | "lanzar_motor"
      | "reanudar_agente"
      | "aprobar_fusionar_pr";
    estado?: SupportEstado;
    resumenSolucion?: string;
    notificarUsuario?: boolean;
    provider?: SupportSolverProviderId;
    cursorModel?: "auto" | "composer-2.5" | null;
    debateMode?: boolean;
    ejecutarAhora?: boolean;
    instrucciones?: string;
  } | null;

  const ahora = new Date().toISOString();

  // 1. Cambiar estado manualmente (en curso, esperando datos, proponer solución manual o cierre forzoso)
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
        avisarUsuarioTicketPush({
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
        })
      );
    }

    return NextResponse.json({ ok: true, ticket: actualizado });
  }

  // 2. Configurar a demanda el modo/motor de ESTE ticket concreto (y opcionalmente ejecutarlo al momento)
  if (body?.accion === "configurar_modo_ticket" && body.provider) {
    const provider = body.provider;
    const cursorModel =
      body.cursorModel === "auto" || body.cursorModel === "composer-2.5"
        ? body.cursorModel
        : ticket.cursor_model_override ?? settings.cursor_model ?? "auto";
    const debateMode = Boolean(body.debateMode ?? ticket.debate_mode);

    const patch: Record<string, unknown> = {
      solver_provider: provider,
      cursor_model_override: cursorModel,
      debate_mode: debateMode,
      updated_at: ahora,
    };
    if (provider === "manual" && body.ejecutarAhora) {
      patch.estado = "en_curso_manual";
    }

    const { data: actualizado, error } = await admin
      .from("support_tickets")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !actualizado) {
      return NextResponse.json({ ok: false, error: error?.message || "No se pudo guardar el modo del ticket." }, { status: 500 });
    }

    const etiqueta = SUPPORT_SOLVER_LABELS[provider]?.label ?? provider;
    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "sistema",
      interno: true,
      cuerpo: `Modo de este ticket cambiado a «${etiqueta}»${
        provider === "cursor_cloud" || provider === "solo_triaje_ia"
          ? ` · Modelo: ${cursorModel}${provider === "cursor_cloud" && debateMode ? " · Con debate (Autor + Verificador)" : ""}`
          : ""
      }.`,
    });

    if (body.ejecutarAhora) {
      if (provider === "solo_triaje_ia") {
        waitUntil(procesarTicketEnSegundoPlano(id, { forzadoPorSuperadmin: true }));
        return NextResponse.json({
          ok: true,
          ticket: actualizado,
          detalle: `Modo guardado y triaje IA lanzado (${cursorModel}).`,
        });
      }

      if (provider === "cursor_cloud" || provider === "github_issue" || provider === "webhook_externo") {
        const despacho = await despacharMotorResolucion({
          ticket: actualizado as unknown as SupportTicket,
          informeTecnico: actualizado.solucion_resumen || actualizado.descripcion,
          settings,
          providerOverride: provider,
          cursorModelOverride: cursorModel,
          debateModeOverride: debateMode,
          forzadoManualPorAdmin: true,
        });

        await admin.from("support_ticket_messages").insert({
          ticket_id: id,
          user_id: user.id,
          autor_tipo: "agente_codigo",
          interno: true,
          cuerpo: `[Ejecutado a demanda] ${despacho.summary}`,
        });

        if (!despacho.dispatched) {
          return NextResponse.json(
            { ok: false, error: despacho.error || despacho.summary },
            { status: 400 }
          );
        }

        const { data: postDespacho } = await admin
          .from("support_tickets")
          .update({
            estado: "agente_trabajando",
            cursor_agent_id: despacho.cursorAgentId ?? actualizado.cursor_agent_id,
            cursor_run_id: despacho.cursorRunId ?? actualizado.cursor_run_id,
            external_issue_url: despacho.externalIssueUrl ?? actualizado.external_issue_url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        return NextResponse.json({
          ok: true,
          ticket: postDespacho ?? actualizado,
          detalle: despacho.summary,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      ticket: actualizado,
      detalle: `Modo del ticket actualizado a «${etiqueta}».`,
    });
  }

  // 3. Compatibilidad directa con lanzar_motor
  if (body?.accion === "lanzar_motor") {
    const provider =
      body.provider ||
      ticket.solver_provider ||
      (settings.solver_provider === "manual" || settings.solver_provider === "solo_triaje_ia"
        ? "cursor_cloud"
        : settings.solver_provider);

    const despacho = await despacharMotorResolucion({
      ticket,
      informeTecnico: ticket.solucion_resumen || ticket.descripcion,
      settings,
      providerOverride: provider,
      cursorModelOverride: body.cursorModel ?? ticket.cursor_model_override,
      debateModeOverride: body.debateMode ?? ticket.debate_mode,
      forzadoManualPorAdmin: true,
    });

    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "agente_codigo",
      interno: true,
      cuerpo: `[Lanzado a demanda] ${despacho.summary}`,
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

  // 4. Reanudar Cursor Cloud Agent existente con nuevas indicaciones
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

  // 5. Aprobar y fusionar PR en 1 clic -> Pasa a pendiente_confirmacion
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
      "Hemos desplegado una corrección para esta incidencia. Cuando puedas, compruébalo y confírmanos desde tu panel (/soporte) si ya funciona correctamente.";

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
        avisarUsuarioTicketPush({
          userId: actualizado.user_id,
          clave: `soporte:prmerge:${actualizado.id}`,
          titulo: `Solución desplegada en ${actualizado.codigo}`,
          cuerpo: "Comprueba si ya funciona y confírmalo en tu panel.",
          ticketId: actualizado.id,
        })
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
