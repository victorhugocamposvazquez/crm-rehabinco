import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consultarSaludBrevo,
  despacharFilaOutbox,
  encolarYEnviarCorreoSoporte,
  resolverBuzonSoporte,
  resolverRemitenteBrevo,
} from "@/lib/support/brevo";
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

  const [brevoProbe, dbProbe, bucketProbe, empresasRes, outboxRes, runsEstaSemana] = await Promise.all([
    consultarSaludBrevo(),
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

  // 2. Brevo (Alertas de correo)
  const remitente = resolverRemitenteBrevo(settings);
  const buzon = resolverBuzonSoporte(settings);
  const fallosRecientesCorreo = (outboxRes.data ?? []).filter(
    (r) => r.estado === "error" || r.estado === "rebote" || r.estado === "bloqueado"
  ).length;

  if (!brevoProbe.configured) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "aviso",
      detalle: "BREVO_API_KEY aún no configurada en el servidor. Los tickets se guardan igual en BD y quedan listos en cola.",
    });
  } else if (!brevoProbe.ok) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "error",
      detalle: `Error al validar cuenta en Brevo: ${brevoProbe.error}`,
    });
  } else if (!remitente.email || !buzon) {
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: "aviso",
      detalle: `Conectado a Brevo (${brevoProbe.email ?? "OK"}${
        brevoProbe.creditsRemaining != null ? ` · ${brevoProbe.creditsRemaining} créditos` : ""
      }), pero falta indicar el email remitente o el buzón de soporte en Ajustes.`,
    });
  } else {
    const creditosBajos = brevoProbe.creditsRemaining != null && brevoProbe.creditsRemaining < 50;
    checks.push({
      id: "brevo",
      label: "Brevo · Alertas por correo electrónico",
      nivel: creditosBajos || fallosRecientesCorreo > 0 ? "aviso" : "ok",
      detalle: `Activo (${brevoProbe.planType ?? "plan"}) · ${
        brevoProbe.creditsRemaining != null ? `${brevoProbe.creditsRemaining} créditos restantes · ` : ""
      }Remitente: ${remitente.email} · Buzón soporte: ${buzon}${
        fallosRecientesCorreo > 0 ? ` · ${fallosRecientesCorreo} envíos con error en cola.` : "."
      }`,
      extra: {
        credits: brevoProbe.creditsRemaining ?? null,
        accountEmail: brevoProbe.email ?? null,
      },
    });
  }

  // 3. Motor de Triaje IA
  const tieneAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  checks.push({
    id: "triage_ia",
    label: "Motor de Triaje IA (Clasificación y dudas)",
    nivel: settings.solver_provider === "manual" ? "ok" : tieneAnthropic ? "ok" : "aviso",
    detalle:
      settings.solver_provider === "manual"
        ? "Desactivado a propósito (modo 100% manual)."
        : tieneAnthropic
          ? "ANTHROPIC_API_KEY activa · Triaje protegido contra prompt-injection."
          : "Falta ANTHROPIC_API_KEY: los tickets pasarán directamente a revisión manual sin perderse.",
  });

  // 4. Motor de Resolución de Código (agnóstico)
  const solverInfo = SUPPORT_SOLVER_LABELS[settings.solver_provider];
  if (settings.solver_provider === "manual" || settings.solver_provider === "solo_triaje_ia") {
    checks.push({
      id: "solver",
      label: "Motor de resolución de código",
      nivel: "ok",
      detalle: `${solverInfo.label} · Gasto en agentes de código: 0 (${runsEstaSemana}/${settings.max_agent_runs_per_week} esta semana).`,
    });
  } else if (settings.solver_provider === "cursor_cloud") {
    const tieneCursor = Boolean(process.env.CURSOR_API_KEY?.trim());
    const tieneGh = Boolean(process.env.SUPPORT_GITHUB_TOKEN?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · Cursor Cloud Agent",
      nivel: tieneCursor && tieneGh ? "ok" : "aviso",
      detalle: tieneCursor
        ? `Modelo: ${settings.cursor_model} · Ejecuciones últimos 7 días: ${runsEstaSemana}/${settings.max_agent_runs_per_week} (recuerda que Auto/Composer consumen tu bolsa semanal de Cursor).${
            tieneGh ? "" : " Falta SUPPORT_GITHUB_TOKEN para fusionar en 1 clic."
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
        ? `Conectado a ${manifest.githubRepo} · Ejecuciones 7d: ${runsEstaSemana}/${settings.max_agent_runs_per_week}.`
        : "Falta SUPPORT_GITHUB_TOKEN para crear Issues automáticamente.",
    });
  } else {
    const tieneUrl = Boolean(settings.solver_webhook_url?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · Webhook externo",
      nivel: tieneUrl ? "ok" : "error",
      detalle: tieneUrl
        ? `Apuntando a ${settings.solver_webhook_url} · Ejecuciones 7d: ${runsEstaSemana}/${settings.max_agent_runs_per_week}.`
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
    outboxReciente: outboxRes.data ?? [],
  });
}

export async function POST(request: Request) {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user || !user.isSuperadmin) {
    return NextResponse.json({ ok: false, error: "Solo superadministrador." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    accion?: "probar_brevo" | "reintentar_outbox";
    destinatarioEmail?: string;
  } | null;

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);

  if (body?.accion === "probar_brevo") {
    const destino = (body.destinatarioEmail || resolverBuzonSoporte(settings) || user.email || "").trim();
    if (!destino) {
      return NextResponse.json({ ok: false, error: "Indica un email de destino para la prueba." }, { status: 400 });
    }

    const res = await encolarYEnviarCorreoSoporte({
      projectKey: manifest.projectKey,
      destinatarioEmail: destino,
      destinatarioTipo: "prueba",
      evento: "test_salud_brevo",
      asunto: `[Prueba OK] Alertas de soporte activas en ${settings.empresa_nombre}`,
      cuerpoHtml: `<p>Este es un correo de verificación enviado desde la Sala de Salud de Soporte (${settings.empresa_nombre}).</p><p>Brevo ha aceptado el envío correctamente (${new Date().toLocaleString("es-ES")}).</p>`,
      cuerpoTexto: `Correo de prueba de Soporte (${settings.empresa_nombre}) enviado correctamente.`,
      settings,
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error || "Brevo rechazó el envío." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      detalle: `Correo enviado a ${destino}${res.messageId ? ` · ID Brevo: ${res.messageId}` : ""}.`,
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
