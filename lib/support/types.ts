export type SupportCategoria = "duda" | "bug" | "datos" | "mejora";

export type SupportRiesgo = "cero" | "bajo" | "alto";

export type SupportEstado =
  | "nuevo"
  | "triaje"
  | "en_curso_manual"
  | "esperando_usuario"
  | "respondido_ia"
  | "agente_trabajando"
  | "pr_revision"
  | "pendiente_confirmacion"
  | "reabierto"
  | "resuelto"
  | "escalado_humano"
  | "cerrado";

export type SupportSolverProviderId =
  | "manual"
  | "solo_triaje_ia"
  | "cursor_cloud"
  | "github_issue"
  | "webhook_externo";

export type SupportAdhesionEstado = "pendiente" | "aceptada" | "rechazada" | "suspendida";

export type SupportAutorTipo =
  | "usuario"
  | "ia"
  | "agente_codigo"
  | "agente_cursor"
  | "superadmin"
  | "sistema";

export type SupportTelemetryEvent = {
  tipo: "error_js" | "promesa" | "red";
  resumen: string;
  ruta?: string;
  metodo?: string;
  status?: number;
  en: string;
};

export type SupportContextSnapshot = {
  pathname: string;
  viewport?: string;
  userAgent?: string;
  permisosActivos?: string[];
  eventos?: SupportTelemetryEvent[];
};

export type SupportAttachmentRef = {
  path: string;
  nombre: string;
  mime?: string;
  signedUrl?: string;
};

export type SupportTicket = {
  id: string;
  codigo: string;
  project_key: string;
  user_id: string;
  user_email: string | null;
  user_role: string | null;
  titulo: string;
  descripcion: string;
  modulo: string | null;
  categoria: SupportCategoria;
  riesgo: SupportRiesgo;
  estado: SupportEstado;
  contexto: SupportContextSnapshot;
  solver_provider: SupportSolverProviderId | null;
  cursor_model_override: "auto" | "composer-2.5" | null;
  debate_mode: boolean;
  external_issue_url: string | null;
  cursor_agent_id: string | null;
  cursor_run_id: string | null;
  github_branch: string | null;
  github_pr_number: number | null;
  github_pr_url: string | null;
  vercel_preview_url: string | null;
  auto_merge_permitido: boolean;
  solucion_resumen: string | null;
  solucion_propuesta_en: string | null;
  resuelto_en: string | null;
  resuelto_por: "usuario" | "superadmin" | "auto_inactividad" | null;
  reabierto_veces: number;
  created_at: string;
  updated_at: string;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  autor_tipo: SupportAutorTipo;
  cuerpo: string;
  adjuntos: SupportAttachmentRef[];
  interno: boolean;
  created_at: string;
};

export type SupportSettingsRow = {
  project_key: string;
  empresa_nombre: string;
  estado_adhesion: SupportAdhesionEstado;
  aceptada_en: string | null;
  aceptada_por: string | null;
  plan_activo: boolean;
  plan_nombre: string;
  plan_vence_en: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  solver_provider: SupportSolverProviderId;
  solver_webhook_url: string | null;
  cursor_model: "composer-2.5" | "auto";
  auto_merge_enabled: boolean;
  max_agent_runs_per_week: number;
  support_inbox_email: string | null;
  brevo_sender_email: string | null;
  brevo_sender_name: string;
  notify_admin_on_new: boolean;
  notify_user_on_updates: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type SupportHealthCheck = {
  id: string;
  label: string;
  nivel: "ok" | "aviso" | "error";
  detalle: string;
  extra?: Record<string, string | number | boolean | null>;
};

export const SUPPORT_ESTADO_USUARIO_LABEL: Record<SupportEstado, string> = {
  nuevo: "Recibido",
  triaje: "Analizando tu consulta",
  en_curso_manual: "En revisión por soporte",
  esperando_usuario: "Esperando tu respuesta",
  respondido_ia: "Respuesta lista · ¿Te ha servido?",
  agente_trabajando: "Preparando solución técnica",
  pr_revision: "Solución en validación final",
  pendiente_confirmacion: "Solución aplicada · Confirma si funciona",
  reabierto: "Reabierto · En revisión prioritaria",
  resuelto: "Solucionado",
  escalado_humano: "En manos del equipo técnico",
  cerrado: "Cerrado",
};

export const SUPPORT_ESTADO_ADMIN_LABEL: Record<SupportEstado, string> = {
  nuevo: "Nuevo",
  triaje: "En triaje IA",
  en_curso_manual: "En curso (manual)",
  esperando_usuario: "Esperando usuario",
  respondido_ia: "Respondido por IA",
  agente_trabajando: "Motor código trabajando",
  pr_revision: "PR pendiente de revisión",
  pendiente_confirmacion: "Pendiente confirmación usuario",
  reabierto: "Reabierto por usuario",
  resuelto: "Confirmado resuelto",
  escalado_humano: "Escalado a soporte",
  cerrado: "Cerrado",
};

export const SUPPORT_SOLVER_LABELS: Record<SupportSolverProviderId, { label: string; hint: string }> = {
  manual: {
    label: "100% Manual (Humano)",
    hint: "Cero gasto de IA/agentes. Recibes alerta por correo y respondes o resuelves a mano.",
  },
  solo_triaje_ia: {
    label: "Triaje IA + Respuesta a dudas (Sin tocar código)",
    hint: "Responde dudas de uso y deja diagnóstico interno para soporte, pero nunca lanza agentes de código.",
  },
  cursor_cloud: {
    label: "Cursor Cloud Agent (Composer 2.5 / Auto)",
    hint: "Responde dudas y lanza agente en la nube con PR y los 4 candados de seguridad.",
  },
  github_issue: {
    label: "GitHub Issue (Claude Code / Codex / Externo)",
    hint: "Abre automáticamente un Issue estructurado en el repositorio para otro motor o desarrollador.",
  },
  webhook_externo: {
    label: "Webhook externo (n8n / Hub propio / Devin)",
    hint: "Envía el ticket diagnosticado firmado por HTTP a cualquier orquestador externo.",
  },
};

export function requiereConfirmacionUsuario(estado: SupportEstado): boolean {
  return estado === "pendiente_confirmacion" || estado === "respondido_ia";
}

export function esTicketAbierto(estado: SupportEstado): boolean {
  return estado !== "resuelto" && estado !== "cerrado";
}

export function empresaTieneSoporteActivo(
  settings: Pick<SupportSettingsRow, "estado_adhesion" | "plan_activo" | "plan_vence_en"> | null | undefined,
  hoyIso = new Date().toISOString().slice(0, 10)
): { activo: boolean; motivo: string | null } {
  if (!settings) {
    return { activo: false, motivo: "Esta empresa aún no está dada de alta en el servicio de soporte." };
  }
  if (settings.estado_adhesion !== "aceptada") {
    const mapa: Record<SupportAdhesionEstado, string> = {
      pendiente: "La adhesión de esta empresa al soporte está pendiente de aprobación.",
      rechazada: "La adhesión al servicio de soporte no ha sido aprobada.",
      suspendida: "El servicio de soporte para esta empresa está temporalmente pausado.",
      aceptada: "",
    };
    return { activo: false, motivo: mapa[settings.estado_adhesion] || "Adhesión no activa." };
  }
  if (!settings.plan_activo) {
    return { activo: false, motivo: "El plan de soporte de esta empresa no está activo actualmente." };
  }
  if (settings.plan_vence_en && settings.plan_vence_en < hoyIso) {
    return { activo: false, motivo: `El periodo del plan de soporte venció el ${settings.plan_vence_en}.` };
  }
  return { activo: true, motivo: null };
}
