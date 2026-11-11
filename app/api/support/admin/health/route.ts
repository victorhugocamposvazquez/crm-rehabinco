import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consultarSaludYConsumoBrevo,
  despacharFilaOutbox,
  encolarYEnviarCorreoSoporte,
  resolverBuzonSoporte,
  resolverRemitenteCorreo,
} from "@/lib/support/mailer";
import { getSupportProjectManifest } from "@/lib/support/project-manifest";
import { obtenerOCrearAjustesProyecto, obtenerUsuarioSesionSoporte } from "@/lib/support/service";
import { contarEjecucionesAgenteSemana } from "@/lib/support/solver";
import { SUPPORT_SOLVER_LABELS, type SupportHealthCheck, type SupportSettingsRow } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user || !user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Solo superadministrador." }, { status: 403 });
  }

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);
  const admin = createAdminClient();
  const hoyInicioIso = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const hace30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    brevoHealth,
    dbProbe,
    bucketProbe,
    empresasRes,
    outboxRes,
    crmEmailsHoyRes,
    crmEmails30dRes,
    runsEstaSemana,
  ] = await Promise.all([
    consultarSaludYConsumoBrevo(),
    admin.from("support_tickets").select("id", { count: "exact", head: true }),
    admin.storage.getBucket("support-attachments"),
    admin.from("support_settings").select("*").order("project_key"),
    admin
      .from("support_email_outbox")
      .select(
        "id, destinatario_email, destinatario_tipo, evento, asunto, estado, intentos, ultimo_error, brevo_message_id, created_at, enviado_en, entregado_en"
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("support_email_outbox")
      .select("id", { count: "exact", head: true })
      .gte("created_at", hoyInicioIso),
    admin
      .from("support_email_outbox")
      .select("id", { count: "exact", head: true })
      .gte("created_at", hace30dIso),
    contarEjecucionesAgenteSemana(manifest.projectKey),
  ]);

  const checks: SupportHealthCheck[] = [];

  // 1. Base de datos y almacenamiento del panel (crítico)
  const dbOk = !dbProbe.error && !bucketProbe.error;
  checks.push({
    id: "core_db",
    label: "Base de datos y adjuntos del panel",
    nivel: dbOk ? "ok" : "error",
    detalle: dbOk
      ? `Operativo · Bucket privado activo · ${dbProbe.count ?? 0} tickets registrados.`
      : `Problema en almacenamiento: ${dbProbe.error?.message || bucketProbe.error?.message || "desconocido"}`,
  });

  // 2. Brevo (Control interno para nosotros: estado, límite y consumo real)
  const remitente = resolverRemitenteCorreo(settings);
  const buzon = resolverBuzonSoporte(settings);
  const fallosRecientesCorreo = (outboxRes.data ?? []).filter(
    (r) => r.estado === "error" || r.estado === "rebote" || r.estado === "bloqueado"
  ).length;

  if (!brevoHealth.configured) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "aviso",
      detalle:
        "Falta BREVO_API_KEY en Vercel. El panel de tickets funciona al 100% y guarda los correos en cola para cuando la actives.",
    });
  } else if (!brevoHealth.ok) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "error",
      detalle: `Error al consultar Brevo: ${brevoHealth.error}`,
    });
  } else if (!remitente.email || !buzon) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "aviso",
      detalle: `Brevo conectado (${brevoHealth.accountEmail ?? "OK"} · Plan ${brevoHealth.planType ?? "activo"} · ${
        brevoHealth.creditsRemaining ?? "—"
      } créditos disponibles), pero falta rellenar abajo tu correo de soporte o el remitente.`,
    });
  } else {
    const creditosBajos = brevoHealth.creditsRemaining != null && brevoHealth.creditsRemaining < 40;
    const usadosRef =
      brevoHealth.planType === "free"
        ? `Hoy: ${brevoHealth.usage?.sentToday ?? 0} usados`
        : `30d: ${brevoHealth.usage?.sentLast30d ?? 0} usados`;
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: creditosBajos || fallosRecientesCorreo > 0 ? "aviso" : "ok",
      detalle: `Activo (Plan ${brevoHealth.planType}) · ${usadosRef} · Quedan ${
        brevoHealth.creditsRemaining ?? "—"
      }${brevoHealth.estimatedLimit ? ` de ~${brevoHealth.estimatedLimit}` : ""} créditos · Remitente: ${remitente.email} → Soporte: ${buzon}${
        fallosRecientesCorreo > 0 ? ` · ${fallosRecientesCorreo} con error en cola.` : "."
      }`,
    });
  }

  // 3. Motor de Triaje IA (Prioridad #1: Cursor Auto / Composer 2.5)
  const tieneCursor = Boolean(process.env.CURSOR_API_KEY?.trim());
  const tieneAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  checks.push({
    id: "triage_ia",
    label: "Motor de Triaje IA (Prioridad #1: Cursor Auto / Composer 2.5)",
    nivel:
      settings.solver_provider === "manual"
        ? "ok"
        : tieneCursor || tieneAnthropic
          ? "ok"
          : "aviso",
    detalle:
      settings.solver_provider === "manual"
        ? "Modo por defecto en 100% Manual (puedes activar Triaje o Agente a demanda en cada ticket)."
        : tieneCursor
          ? `Conectado a Cursor (${settings.cursor_model || "auto"} como primera opción de máximo ahorro).`
          : tieneAnthropic
            ? "Usando respaldo secundario (Anthropic). Añade CURSOR_API_KEY en Vercel para priorizar Cursor Auto / Composer 2.5."
            : "Añade CURSOR_API_KEY en Vercel para activar el triaje económico con Cursor Auto / Composer 2.5. Mientras tanto, ningún ticket falla.",
  });

  // 4. Motor de Resolución y cuota semanal
  const solverInfo = SUPPORT_SOLVER_LABELS[settings.solver_provider];
  if (settings.solver_provider === "manual" || settings.solver_provider === "solo_triaje_ia") {
    checks.push({
      id: "solver",
      label: "Motor de resolución por defecto",
      nivel: "ok",
      detalle: `${solverInfo.label} · Ejecuciones agentes últimos 7d: ${runsEstaSemana} de ${settings.max_agent_runs_per_week}.`,
    });
  } else if (settings.solver_provider === "cursor_cloud") {
    const tieneGh = Boolean(process.env.SUPPORT_GITHUB_TOKEN?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · Cursor Cloud Agent",
      nivel: tieneCursor && tieneGh ? "ok" : "aviso",
      detalle: tieneCursor
        ? `Modelo base: ${settings.cursor_model} · Usados últimos 7d: ${runsEstaSemana} de ${settings.max_agent_runs_per_week}.${
            tieneGh ? "" : " Falta SUPPORT_GITHUB_TOKEN para fusionar PRs en 1 clic."
          }`
        : "Seleccionado Cursor Cloud, pero falta CURSOR_API_KEY en el servidor.",
    });
  } else if (settings.solver_provider === "github_issue") {
    const tieneGh = Boolean(process.env.SUPPORT_GITHUB_TOKEN?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · GitHub Issues",
      nivel: tieneGh ? "ok" : "error",
      detalle: tieneGh
        ? `Conectado a ${manifest.githubRepo} · Usados últimos 7d: ${runsEstaSemana} de ${settings.max_agent_runs_per_week}.`
        : "Falta SUPPORT_GITHUB_TOKEN para crear Issues automáticamente.",
    });
  } else {
    const tieneUrl = Boolean(settings.solver_webhook_url?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · Webhook externo",
      nivel: tieneUrl ? "ok" : "error",
      detalle: tieneUrl
        ? `Apuntando a ${settings.solver_webhook_url} · Usados últimos 7d: ${runsEstaSemana} de ${settings.max_agent_runs_per_week}.`
        : "Falta configurar la URL del webhook externo.",
    });
  }

  const nivelGeneral: "ok" | "aviso" | "error" = checks.some((c) => c.nivel === "error")
    ? "error"
    : checks.some((c) => c.nivel === "aviso")
      ? "aviso"
      : "ok";

  return NextResponse.json({
    ok: true,
    nivelGeneral,
    checks,
    settings,
    empresas: (empresasRes.data ?? [settings]) as unknown as SupportSettingsRow[],
    runsEstaSemana,
    brevo: {
      ...brevoHealth,
      crmSentToday: crmEmailsHoyRes.count ?? 0,
      crmSentLast30d: crmEmails30dRes.count ?? 0,
    },
    outboxReciente: outboxRes.data ?? [],
  });
}

export async function POST(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user || !user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Solo superadministrador." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: "probar_correo" | "reintentar_outbox";
    destinatarioEmail?: string;
  } | null;

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);

  if (body?.accion === "probar_correo") {
    const destino = (body.destinatarioEmail || resolverBuzonSoporte(settings) || user.email || "").trim();
    if (!destino) {
      return NextResponse.json({ ok: false, error: "Indica un correo de destino para la prueba." }, { status: 400 });
    }

    const res = await encolarYEnviarCorreoSoporte({
      projectKey: manifest.projectKey,
      destinatarioEmail: destino,
      destinatarioTipo: "prueba",
      evento: "test_salud_brevo",
      asunto: `[Prueba OK] Alertas de soporte activas en ${settings.empresa_nombre}`,
      cuerpoHtml: `<p>Este es un correo de verificación enviado desde Salud del sistema (${settings.empresa_nombre}).</p><p>Brevo ha procesado el envío correctamente (${new Date().toLocaleString("es-ES")}).</p>`,
      cuerpoTexto: `Correo de prueba de Soporte (${settings.empresa_nombre}) enviado correctamente vía Brevo.`,
      settings,
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error || "Brevo rechazó el envío." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      detalle: `Correo enviado a ${destino}${res.messageId ? ` · Message-ID: ${res.messageId}` : ""}.`,
    });
  }

  if (body?.accion === "reintentar_outbox") {
    const admin = createAdminClient();
    const { data: pendientes } = await admin
      .from("support_email_outbox")
      .select("id")
      .in("estado", ["error", "pendiente"])
      .order("created_at", { ascending: false })
      .limit(15);

    let enviados = 0;
    for (const fila of pendientes ?? []) {
      const r = await despacharFilaOutbox(fila.id, settings);
      if (r.ok) enviados += 1;
    }

    return NextResponse.json({
      ok: true,
      procesados: pendientes?.length ?? 0,
      enviados,
    });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
