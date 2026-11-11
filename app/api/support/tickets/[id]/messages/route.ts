import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificarEventoTicketPorCorreo } from "@/lib/support/brevo";
import {
  avisarSuperadminsPush,
  avisarUsuarioTicketPush,
  firmarAdjuntosMensaje,
  obtenerOCrearAjustesProyecto,
  obtenerUsuarioSesionSoporte,
} from "@/lib/support/service";
import type { SupportEstado, SupportTicket } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
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
  if (!user.isSuperadmin && ticketRow.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Sin acceso." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    cuerpo?: string;
    interno?: boolean;
    adjuntos?: Array<{ path: string; nombre: string; mime?: string }>;
  } | null;

  const cuerpo = (body?.cuerpo || "").trim();
  const adjuntosLimpios = Array.isArray(body?.adjuntos)
    ? body!.adjuntos
        .filter(
          (a) =>
            a &&
            typeof a.path === "string" &&
            (user.isSuperadmin || a.path.startsWith(`${user.id}/`))
        )
        .slice(0, 4)
    : [];

  if (!cuerpo && adjuntosLimpios.length === 0) {
    return NextResponse.json({ ok: false, error: "Escribe un mensaje." }, { status: 400 });
  }

  const interno = user.isSuperadmin ? Boolean(body?.interno) : false;
  const autorTipo = user.isSuperadmin && ticketRow.user_id !== user.id ? "superadmin" : "usuario";

  const { data: msg, error: msgError } = await admin
    .from("support_ticket_messages")
    .insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: autorTipo,
      interno,
      cuerpo: cuerpo || "Adjunto añadido",
      adjuntos: adjuntosLimpios,
    })
    .select("*")
    .single();

  if (msgError || !msg) {
    return NextResponse.json(
      { ok: false, error: msgError?.message || "No se pudo guardar el mensaje." },
      { status: 500 }
    );
  }

  const ahora = new Date().toISOString();
  let nuevoEstado = ticketRow.estado as SupportEstado;
  if (!interno) {
    if (autorTipo === "superadmin") {
      if (nuevoEstado === "nuevo" || nuevoEstado === "reabierto" || nuevoEstado === "escalado_humano") {
        nuevoEstado = "esperando_usuario";
      }
    } else {
      if (nuevoEstado === "esperando_usuario" || nuevoEstado === "respondido_ia" || nuevoEstado === "pendiente_confirmacion") {
        nuevoEstado = "en_curso_manual";
      } else if (nuevoEstado === "resuelto" || nuevoEstado === "cerrado") {
        nuevoEstado = "reabierto";
      }
    }
  }

  const { data: actualizado } = await admin
    .from("support_tickets")
    .update({ estado: nuevoEstado, updated_at: ahora })
    .eq("id", id)
    .select("*")
    .single();

  if (!interno && actualizado) {
    waitUntil(
      (async () => {
        const settings = await obtenerOCrearAjustesProyecto(actualizado.project_key);
        if (autorTipo === "superadmin") {
          await avisarUsuarioTicketPush({
            userId: actualizado.user_id,
            clave: `soporte:msg:${msg.id}`,
            titulo: `Nueva respuesta en ${actualizado.codigo}`,
            cuerpo: cuerpo.slice(0, 120),
            ticketId: actualizado.id,
          });
          await notificarEventoTicketPorCorreo({
            evento: "respuesta_soporte",
            ticket: actualizado as unknown as SupportTicket,
            mensajeAdicional: cuerpo,
            settings,
          });
        } else {
          await avisarSuperadminsPush({
            clave: `soporte:usrmsg:${msg.id}`,
            titulo: `Mensaje en ${actualizado.codigo}`,
            cuerpo: cuerpo.slice(0, 120),
            ticketId: actualizado.id,
          });
          await notificarEventoTicketPorCorreo({
            evento: "mensaje_usuario",
            ticket: actualizado as unknown as SupportTicket,
            mensajeAdicional: cuerpo,
            settings,
          });
        }
      })()
    );
  }

  const firmado = {
    ...msg,
    adjuntos: await firmarAdjuntosMensaje(msg.adjuntos),
  };

  return NextResponse.json({
    ok: true,
    message: firmado,
    ticket: actualizado ?? ticketRow,
  });
}
