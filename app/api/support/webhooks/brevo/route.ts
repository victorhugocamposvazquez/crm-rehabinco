import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recibe eventos transaccionales de Brevo (delivered, hardBounce, softBounce, blocked, invalid, error)
 * para actualizar el semáforo de entregabilidad en la Sala de Salud del panel de tickets.
 */
export async function POST(request: Request) {
  const tokenEsperado = process.env.BREVO_WEBHOOK_TOKEN?.trim();
  if (tokenEsperado) {
    const url = new URL(request.url);
    const tokenRecibido = url.searchParams.get("token") || request.headers.get("x-brevo-token");
    if (tokenRecibido !== tokenEsperado) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as {
    event?: string;
    "message-id"?: string;
    messageId?: string;
    reason?: string;
  } | null;

  const messageId = body?.["message-id"] || body?.messageId;
  const event = (body?.event || "").trim();
  if (!messageId || !event) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const ahora = new Date().toISOString();
  let nuevoEstado: "entregado" | "rebote" | "bloqueado" | "error" | "enviado" = "enviado";
  if (event === "delivered" || event === "opened" || event === "click" || event === "uniqueOpened") {
    nuevoEstado = "entregado";
  } else if (event === "hardBounce" || event === "softBounce" || event === "invalid") {
    nuevoEstado = "rebote";
  } else if (event === "blocked" || event === "spam" || event === "unsubscribed") {
    nuevoEstado = "bloqueado";
  } else if (event === "error") {
    nuevoEstado = "error";
  }

  const admin = createAdminClient();
  await admin
    .from("support_email_outbox")
    .update({
      estado: nuevoEstado,
      ultimo_evento_brevo: event,
      ...(nuevoEstado === "entregado" ? { entregado_en: ahora } : {}),
      ...(body?.reason ? { ultimo_error: body.reason.slice(0, 300) } : {}),
      updated_at: ahora,
    })
    .eq("brevo_message_id", messageId);

  return NextResponse.json({ ok: true });
}
