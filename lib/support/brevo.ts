import { createAdminClient } from "@/lib/supabase/admin";
import { getSupportProjectManifest } from "./project-manifest";
import type { SupportSettingsRow, SupportTicket } from "./types";

const BREVO_BASE = "https://api.brevo.com/v3";

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BrevoAccountProbe = {
  configured: boolean;
  ok: boolean;
  email?: string;
  companyName?: string;
  planType?: string;
  creditsRemaining?: number | null;
  relayHost?: string;
  error?: string;
};

export async function consultarSaludBrevo(): Promise<BrevoAccountProbe> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      ok: false,
      error: "Falta la variable BREVO_API_KEY en el servidor.",
    };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${BREVO_BASE}/account`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const data = (await res.json().catch(() => ({}))) as {
      email?: string;
      companyName?: string;
      message?: string;
      plan?: Array<{ type?: string; credits?: number }>;
      relay?: { data?: { relay?: string } };
    };

    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        error: data?.message || `Brevo devolvió HTTP ${res.status}.`,
      };
    }

    const planPrincipal = data.plan?.[0];
    return {
      configured: true,
      ok: true,
      email: data.email,
      companyName: data.companyName,
      planType: planPrincipal?.type ?? "desconocido",
      creditsRemaining: typeof planPrincipal?.credits === "number" ? planPrincipal.credits : null,
      relayHost: data.relay?.data?.relay,
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo conectar con la API de Brevo.",
    };
  }
}

export function resolverRemitenteBrevo(settings?: Partial<SupportSettingsRow> | null): {
  email: string | null;
  name: string;
} {
  const email = (
    settings?.brevo_sender_email ||
    process.env.BREVO_SENDER_EMAIL ||
    settings?.support_inbox_email ||
    process.env.SUPPORT_INBOX_EMAIL ||
    ""
  ).trim();
  const name = (settings?.brevo_sender_name || process.env.BREVO_SENDER_NAME || "Soporte CRM").trim();
  return { email: email || null, name };
}

export function resolverBuzonSoporte(settings?: Partial<SupportSettingsRow> | null): string | null {
  const email = (settings?.support_inbox_email || process.env.SUPPORT_INBOX_EMAIL || "").trim();
  return email || null;
}

/**
 * Registra SIEMPRE el correo en support_email_outbox y lo intenta despachar por Brevo.
 * Nunca lanza excepciones hacia afuera para que el flujo del ticket sea indestructible.
 */
export async function encolarYEnviarCorreoSoporte(input: {
  projectKey?: string;
  ticketId?: string | null;
  destinatarioEmail: string;
  destinatarioTipo: "usuario" | "soporte" | "prueba";
  evento: string;
  asunto: string;
  cuerpoHtml: string;
  cuerpoTexto: string;
  settings?: Partial<SupportSettingsRow> | null;
}): Promise<{ ok: boolean; outboxId?: string; messageId?: string; error?: string }> {
  const destinatario = input.destinatarioEmail.trim();
  if (!destinatario || !destinatario.includes("@")) {
    return { ok: false, error: "Email destinatario vacío o inválido." };
  }

  try {
    const admin = createAdminClient();
    const manifest = getSupportProjectManifest();
    const projectKey = input.projectKey || manifest.projectKey;

    const { data: fila, error: insertError } = await admin
      .from("support_email_outbox")
      .insert({
        project_key: projectKey,
        ticket_id: input.ticketId ?? null,
        destinatario_email: destinatario,
        destinatario_tipo: input.destinatarioTipo,
        evento: input.evento,
        asunto: input.asunto,
        cuerpo_html: input.cuerpoHtml,
        cuerpo_texto: input.cuerpoTexto,
        estado: "pendiente",
        intentos: 0,
      })
      .select("id")
      .single();

    if (insertError || !fila?.id) {
      return { ok: false, error: insertError?.message || "No se pudo registrar en outbox." };
    }

    return await despacharFilaOutbox(fila.id, input.settings);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Fallo inesperado en correo." };
  }
}

export async function despacharFilaOutbox(
  outboxId: string,
  settingsOverride?: Partial<SupportSettingsRow> | null
): Promise<{ ok: boolean; outboxId: string; messageId?: string; error?: string }> {
  const admin = createAdminClient();
  const { data: item } = await admin
    .from("support_email_outbox")
    .select("*")
    .eq("id", outboxId)
    .maybeSingle();

  if (!item) {
    return { ok: false, outboxId, error: "Registro outbox no encontrado." };
  }

  let settings = settingsOverride;
  if (!settings) {
    const { data } = await admin
      .from("support_settings")
      .select("*")
      .eq("project_key", item.project_key)
      .maybeSingle();
    settings = data;
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = resolverRemitenteBrevo(settings);
  const intentos = (item.intentos ?? 0) + 1;

  if (!apiKey || !sender.email) {
    const motivo = !apiKey
      ? "BREVO_API_KEY no configurada."
      : "Falta email remitente de Brevo (brevo_sender_email o BREVO_SENDER_EMAIL).";
    await admin
      .from("support_email_outbox")
      .update({
        estado: "error",
        intentos,
        ultimo_error: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", outboxId);
    return { ok: false, outboxId, error: motivo };
  }

  try {
    const replyToEmail = resolverBuzonSoporte(settings) || sender.email;
    const res = await fetch(`${BREVO_BASE}/smtp/email`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: sender.name, email: sender.email },
        to: [{ email: item.destinatario_email }],
        replyTo: { email: replyToEmail, name: sender.name },
        subject: item.asunto,
        htmlContent: item.cuerpo_html,
        textContent: item.cuerpo_texto,
        tags: ["crm-soporte", item.project_key, item.evento],
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
    if (!res.ok) {
      const motivo = body?.message || `HTTP ${res.status} al enviar con Brevo`;
      await admin
        .from("support_email_outbox")
        .update({
          estado: "error",
          intentos,
          ultimo_error: motivo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", outboxId);
      return { ok: false, outboxId, error: motivo };
    }

    const ahora = new Date().toISOString();
    await admin
      .from("support_email_outbox")
      .update({
        estado: "enviado",
        intentos,
        brevo_message_id: body.messageId ?? null,
        ultimo_error: null,
        enviado_en: ahora,
        updated_at: ahora,
      })
      .eq("id", outboxId);

    return { ok: true, outboxId, messageId: body.messageId };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "Error de red con Brevo";
    await admin
      .from("support_email_outbox")
      .update({
        estado: "error",
        intentos,
        ultimo_error: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", outboxId);
    return { ok: false, outboxId, error: motivo };
  }
}

function plantillaCorreoHtml(input: {
  cabecera: string;
  titulo: string;
  bloques: string[];
  ctaTexto: string;
  ctaUrl: string;
  pie?: string;
}): string {
  const parrafos = input.bloques
    .map((b) => `<p style="margin:0 0 12px;line-height:1.55;color:#262626;font-size:14px;">${b}</p>`)
    .join("");
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:14px;padding:24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#666666;text-transform:uppercase;letter-spacing:.04em;">${escaparHtml(input.cabecera)}</p>
      <h1 style="margin:0 0 16px;font-size:18px;color:#111111;">${escaparHtml(input.titulo)}</h1>
      ${parrafos}
      <div style="margin:20px 0 8px;">
        <a href="${escaparHtml(input.ctaUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:9px;font-size:14px;font-weight:600;">${escaparHtml(input.ctaTexto)}</a>
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#737373;">${escaparHtml(input.pie || "Puedes responder o hacer seguimiento desde tu panel de soporte en el CRM.")}</p>
    </div>
  </body>
</html>`;
}

export async function notificarEventoTicketPorCorreo(input: {
  evento:
    | "ticket_creado"
    | "respuesta_soporte"
    | "solucion_propuesta"
    | "reabierto_por_usuario"
    | "mensaje_usuario"
    | "escalado_soporte";
  ticket: Pick<
    SupportTicket,
    "id" | "codigo" | "project_key" | "titulo" | "descripcion" | "user_email" | "user_role" | "modulo"
  >;
  mensajeAdicional?: string;
  settings: SupportSettingsRow;
}): Promise<void> {
  const manifest = getSupportProjectManifest();
  const urlUsuario = `${manifest.baseUrl}/soporte?ticket=${encodeURIComponent(input.ticket.id)}`;
  const urlAdmin = `${manifest.baseUrl}/settings/soporte?ticket=${encodeURIComponent(input.ticket.id)}`;
  const buzonSoporte = resolverBuzonSoporte(input.settings);

  // 1. Correos hacia Soporte (tú)
  if (
    buzonSoporte &&
    input.settings.notify_admin_on_new &&
    (input.evento === "ticket_creado" ||
      input.evento === "reabierto_por_usuario" ||
      input.evento === "mensaje_usuario" ||
      input.evento === "escalado_soporte")
  ) {
    const etiquetas: Record<string, string> = {
      ticket_creado: `[${input.ticket.codigo}] Nuevo ticket en ${input.settings.empresa_nombre}: ${input.ticket.titulo}`,
      reabierto_por_usuario: `[${input.ticket.codigo}] REABIERTO por el usuario: ${input.ticket.titulo}`,
      mensaje_usuario: `[${input.ticket.codigo}] Nuevo mensaje del usuario: ${input.ticket.titulo}`,
      escalado_soporte: `[${input.ticket.codigo}] Requiere revisión de soporte: ${input.ticket.titulo}`,
    };
    const asunto = etiquetas[input.evento] ?? `[${input.ticket.codigo}] ${input.ticket.titulo}`;
    const detalle = input.mensajeAdicional || input.ticket.descripcion;
    const html = plantillaCorreoHtml({
      cabecera: `${input.settings.empresa_nombre} · ${input.ticket.codigo}`,
      titulo: input.ticket.titulo,
      bloques: [
        `<strong>Usuario:</strong> ${escaparHtml(input.ticket.user_email || "Sin email")} (${escaparHtml(input.ticket.user_role || "usuario")}) · <strong>Zona:</strong> ${escaparHtml(input.ticket.modulo || "general")}`,
        escaparHtml(detalle).replace(/\n/g, "<br/>"),
      ],
      ctaTexto: "Abrir en consola de soporte",
      ctaUrl: urlAdmin,
    });
    const texto = `${asunto}\n\nUsuario: ${input.ticket.user_email || "—"}\n${detalle}\n\nConsola: ${urlAdmin}`;
    await encolarYEnviarCorreoSoporte({
      projectKey: input.ticket.project_key,
      ticketId: input.ticket.id,
      destinatarioEmail: buzonSoporte,
      destinatarioTipo: "soporte",
      evento: input.evento,
      asunto,
      cuerpoHtml: html,
      cuerpoTexto: texto,
      settings: input.settings,
    });
  }

  // 2. Correos hacia la persona que abrió el ticket
  if (
    input.ticket.user_email &&
    input.settings.notify_user_on_updates &&
    (input.evento === "ticket_creado" ||
      input.evento === "respuesta_soporte" ||
      input.evento === "solucion_propuesta")
  ) {
    const asuntos: Record<string, string> = {
      ticket_creado: `[${input.ticket.codigo}] Hemos recibido tu consulta: ${input.ticket.titulo}`,
      respuesta_soporte: `[${input.ticket.codigo}] Tienes una nueva respuesta en tu ticket`,
      solucion_propuesta: `[${input.ticket.codigo}] Propuesta de solución lista · Confirma si ya funciona`,
    };
    const asunto = asuntos[input.evento] ?? `[${input.ticket.codigo}] Actualización de soporte`;
    const bloques =
      input.evento === "ticket_creado"
        ? [
            `Hemos registrado tu consulta con el código <strong>${escaparHtml(input.ticket.codigo)}</strong>.`,
            `Puedes ver el estado en cualquier momento, añadir comentarios o confirmar cuando quede solucionado desde tu panel de soporte.`,
          ]
        : input.evento === "solucion_propuesta"
          ? [
              escaparHtml(input.mensajeAdicional || "Hemos aplicado una solución para tu consulta.").replace(/\n/g, "<br/>"),
              `<strong>Importante:</strong> no cerramos el ticket sin tu confirmación. Entra a tu panel y pulsa <em>«Sí, está solucionado»</em> o indícanos si sigue ocurriendo.`,
            ]
          : [
              escaparHtml(input.mensajeAdicional || "Hay una nueva actualización en tu consulta.").replace(/\n/g, "<br/>"),
            ];

    const html = plantillaCorreoHtml({
      cabecera: `Soporte · ${input.ticket.codigo}`,
      titulo: input.ticket.titulo,
      bloques,
      ctaTexto:
        input.evento === "solucion_propuesta"
          ? "Comprobar y confirmar si está resuelto"
          : "Ver estado de mi ticket",
      ctaUrl: urlUsuario,
    });
    const texto = `${asunto}\n\n${input.mensajeAdicional || input.ticket.titulo}\n\nVer mi ticket: ${urlUsuario}`;
    await encolarYEnviarCorreoSoporte({
      projectKey: input.ticket.project_key,
      ticketId: input.ticket.id,
      destinatarioEmail: input.ticket.user_email,
      destinatarioTipo: "usuario",
      evento: input.evento,
      asunto,
      cuerpoHtml: html,
      cuerpoTexto: texto,
      settings: input.settings,
    });
  }
}
