import type {
  SupportAttachmentRef,
  SupportCategoria,
  SupportContextSnapshot,
  SupportEstado,
  SupportHealthCheck,
  SupportSettingsRow,
  SupportSolverProviderId,
  SupportTicket,
  SupportTicketMessage,
} from "./types";

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_SUPPORT_API_BASE || "/api/support").replace(/\/+$/, "");
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Error HTTP ${res.status}`);
  }
  return json;
}

export type SupportStatusResponse = {
  ok: true;
  activo: boolean;
  motivo: string | null;
  empresaNombre: string;
  projectKey: string;
  abiertosCount: number;
  esperandoConfirmacionCount: number;
};

export async function fetchSupportStatus(): Promise<SupportStatusResponse> {
  const res = await fetch(`${apiBase()}/status`, { cache: "no-store" });
  return parseJson<SupportStatusResponse>(res);
}

export async function fetchUserSupportPrefs(): Promise<{
  ok: true;
  alertEmail: string;
  notifyEmail: boolean;
}> {
  const res = await fetch(`${apiBase()}/prefs`, { cache: "no-store" });
  return parseJson(res);
}

export async function guardarUserSupportPrefs(input: {
  alertEmail: string;
  notifyEmail: boolean;
}): Promise<{ ok: true; alertEmail: string; notifyEmail: boolean }> {
  const res = await fetch(`${apiBase()}/prefs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function listarTicketsSoporte(modo?: "mios" | "todos", estado?: string): Promise<{
  ok: true;
  activo: boolean;
  motivo: string | null;
  tickets: SupportTicket[];
}> {
  const params = new URLSearchParams();
  if (modo) params.set("modo", modo);
  if (estado) params.set("estado", estado);
  const qs = params.toString();
  const res = await fetch(`${apiBase()}/tickets${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  return parseJson(res);
}

export async function crearTicketSoporte(input: {
  titulo: string;
  descripcion: string;
  categoria?: SupportCategoria;
  modulo?: string;
  contactEmail?: string;
  contexto: SupportContextSnapshot;
  adjuntos?: SupportAttachmentRef[];
}): Promise<{ ok: true; ticket: SupportTicket }> {
  const res = await fetch(`${apiBase()}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function obtenerTicketDetalle(id: string): Promise<{
  ok: true;
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}> {
  const res = await fetch(`${apiBase()}/tickets/${encodeURIComponent(id)}`, { cache: "no-store" });
  return parseJson(res);
}

export async function enviarMensajeTicket(
  ticketId: string,
  input: { cuerpo: string; interno?: boolean; adjuntos?: SupportAttachmentRef[] }
): Promise<{ ok: true; message: SupportTicketMessage; ticket: SupportTicket }> {
  const res = await fetch(`${apiBase()}/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function accionUsuarioTicket(
  ticketId: string,
  input: { accion: "confirmar_resuelto" | "reabrir"; comentario?: string }
): Promise<{ ok: true; ticket: SupportTicket }> {
  const res = await fetch(`${apiBase()}/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function accionSuperadminTicket(
  ticketId: string,
  input:
    | { accion: "cambiar_estado"; estado: SupportEstado; resumenSolucion?: string; notificarUsuario?: boolean }
    | {
        accion: "configurar_modo_ticket";
        provider: SupportSolverProviderId;
        cursorModel?: "auto" | "composer-2.5" | null;
        debateMode?: boolean;
        ejecutarAhora?: boolean;
      }
    | {
        accion: "lanzar_motor";
        provider?: SupportSolverProviderId;
        cursorModel?: "auto" | "composer-2.5" | null;
        debateMode?: boolean;
      }
    | { accion: "reanudar_agente"; instrucciones: string }
    | { accion: "aprobar_fusionar_pr" }
): Promise<{ ok: true; ticket: SupportTicket; detalle?: string }> {
  const res = await fetch(`${apiBase()}/tickets/${encodeURIComponent(ticketId)}/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(res);
}

export async function subirAdjuntoSoporte(blob: Blob, nombre = "captura.png"): Promise<SupportAttachmentRef> {
  const form = new FormData();
  form.append("file", blob, nombre);
  const res = await fetch(`${apiBase()}/attachments`, {
    method: "POST",
    body: form,
  });
  const json = await parseJson<{ ok: true; attachment: SupportAttachmentRef }>(res);
  return json.attachment;
}

export type SupportAdminHealthResponse = {
  ok: true;
  nivelGeneral: "ok" | "aviso" | "error";
  checks: SupportHealthCheck[];
  settings: SupportSettingsRow;
  empresas: SupportSettingsRow[];
  runsEstaSemana: number;
  brevo: {
    configured: boolean;
    ok: boolean;
    accountEmail?: string;
    companyName?: string;
    planType?: string;
    creditsRemaining?: number | null;
    estimatedLimit?: number | null;
    error?: string;
    crmSentToday: number;
    crmSentLast30d: number;
    usage?: {
      sentToday: number;
      deliveredToday: number;
      sentLast30d: number;
      deliveredLast30d: number;
      bouncesLast30d: number;
      blockedLast30d: number;
    };
  };
  outboxReciente: Array<{
    id: string;
    destinatario_email: string;
    destinatario_tipo: string;
    evento: string;
    asunto: string;
    estado: string;
    intentos: number;
    ultimo_error: string | null;
    brevo_message_id: string | null;
    created_at: string;
    enviado_en: string | null;
    entregado_en: string | null;
  }>;
};

export async function fetchSupportAdminHealth(): Promise<SupportAdminHealthResponse> {
  const res = await fetch(`${apiBase()}/admin/health`, { cache: "no-store" });
  return parseJson(res);
}

export async function guardarSupportSettings(
  patch: Partial<SupportSettingsRow> & { project_key: string }
): Promise<{ ok: true; settings: SupportSettingsRow }> {
  const res = await fetch(`${apiBase()}/admin/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function enviarCorreoPruebaSoporte(destinatarioEmail?: string): Promise<{ ok: true; detalle: string }> {
  const res = await fetch(`${apiBase()}/admin/health`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "probar_correo", destinatarioEmail }),
  });
  return parseJson(res);
}

export async function reintentarOutboxFallidos(): Promise<{ ok: true; procesados: number; enviados: number }> {
  const res = await fetch(`${apiBase()}/admin/health`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "reintentar_outbox" }),
  });
  return parseJson(res);
}
