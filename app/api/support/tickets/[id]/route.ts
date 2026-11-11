import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  avisarSuperadminsPush,
  firmarAdjuntosMensaje,
  obtenerUsuarioSesionSoporte,
} from "@/lib/support/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !ticket) {
    return NextResponse.json({ ok: false, error: "Ticket no encontrado." }, { status: 404 });
  }
  if (!user.isSuperadmin && ticket.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Sin acceso a este ticket." }, { status: 403 });
  }

  let msgQuery = admin
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (!user.isSuperadmin) {
    msgQuery = msgQuery.eq("interno", false);
  }

  const { data: rows } = await msgQuery;
  const messages = await Promise.all(
    (rows ?? []).map(async (m) => ({
      ...m,
      adjuntos: await firmarAdjuntosMensaje(m.adjuntos),
    }))
  );

  return NextResponse.json({ ok: true, ticket, messages });
}

/**
 * Acciones de la persona que abrió el ticket:
 * - confirmar_resuelto: el usuario verifica que ya funciona -> pasa a 'resuelto'
 * - reabrir: el usuario indica que NO está solucionado -> pasa a 'reabierto' y alerta a soporte
 */
export async function PATCH(
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
    return NextResponse.json({ ok: false, error: "Sin permiso." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: "confirmar_resuelto" | "reabrir";
    comentario?: string;
  } | null;

  const ahora = new Date().toISOString();
  const comentario = (body?.comentario || "").trim();

  if (body?.accion === "confirmar_resuelto") {
    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "usuario",
      interno: false,
      cuerpo: comentario || "Confirmado: ya está solucionado. Gracias.",
    });

    const { data: actualizado, error } = await admin
      .from("support_tickets")
      .update({
        estado: "resuelto",
        resuelto_en: ahora,
        resuelto_por: "usuario",
        auto_merge_permitido: false,
        updated_at: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !actualizado) {
      return NextResponse.json({ ok: false, error: error?.message || "No se pudo actualizar." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ticket: actualizado });
  }

  if (body?.accion === "reabrir") {
    const texto = comentario || "Sigue sin funcionar tras la propuesta de solución.";
    await admin.from("support_ticket_messages").insert({
      ticket_id: id,
      user_id: user.id,
      autor_tipo: "usuario",
      interno: false,
      cuerpo: texto,
    });

    const { data: actualizado, error } = await admin
      .from("support_tickets")
      .update({
        estado: "reabierto",
        resuelto_en: null,
        resuelto_por: null,
        reabierto_veces: (ticketRow.reabierto_veces ?? 0) + 1,
        auto_merge_permitido: false,
        updated_at: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error || !actualizado) {
      return NextResponse.json({ ok: false, error: error?.message || "No se pudo reabrir." }, { status: 500 });
    }

    waitUntil(
      avisarSuperadminsPush({
        clave: `soporte:reabierto:${actualizado.id}:${Date.now()}`,
        titulo: `Ticket ${actualizado.codigo} REABIERTO`,
        cuerpo: texto.slice(0, 120),
        ticketId: actualizado.id,
      })
    );

    return NextResponse.json({ ok: true, ticket: actualizado });
  }

  return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
}
