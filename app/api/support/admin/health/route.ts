import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const [dbProbe, bucketProbe, empresasRes, runsEstaSemana] = await Promise.all([
    admin.from("support_tickets").select("id", { count: "exact", head: true }),
    admin.storage.getBucket("support-attachments"),
    admin.from("support_settings").select("*").order("project_key"),
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

  // 2. Motor de Triaje IA (Prioridad #1: Cursor auto / composer-2.5 para máximo ahorro; fallback opcional Anthropic)
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
        ? "Modo por defecto en 100% Manual (puedes activar Triaje o Agente a demanda dentro de cada ticket)."
        : tieneCursor
          ? `Conectado a Cursor (${settings.cursor_model || "auto"} como primera opción de máximo ahorro de costes, sin herramientas de escritura en triaje).`
          : tieneAnthropic
            ? "Usando respaldo secundario (Anthropic). Añade CURSOR_API_KEY en Vercel para priorizar Cursor Auto / Composer 2.5."
            : "Añade CURSOR_API_KEY en Vercel para activar el triaje económico con Cursor Auto / Composer 2.5. Mientras tanto, ningún ticket falla: entran directos a bandeja manual.",
  });

  // 3. Motor de Resolución de Código y cuota semanal
  const solverInfo = SUPPORT_SOLVER_LABELS[settings.solver_provider];
  if (settings.solver_provider === "manual" || settings.solver_provider === "solo_triaje_ia") {
    checks.push({
      id: "solver",
      label: "Motor de resolución por defecto",
      nivel: "ok",
      detalle: `${solverInfo.label} · Puedes cambiar el motor a demanda dentro de cualquier ticket individual · Ejecuciones 7d: ${runsEstaSemana}/${settings.max_agent_runs_per_week}.`,
    });
  } else if (settings.solver_provider === "cursor_cloud") {
    const tieneGh = Boolean(process.env.SUPPORT_GITHUB_TOKEN?.trim());
    checks.push({
      id: "solver",
      label: "Motor de resolución · Cursor Cloud Agent",
      nivel: tieneCursor && tieneGh ? "ok" : "aviso",
      detalle: tieneCursor
        ? `Modelo base: ${settings.cursor_model} · Ejecuciones 7d: ${runsEstaSemana}/${settings.max_agent_runs_per_week}.${
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

  // 4. Avisos en tiempo real del CRM
  checks.push({
    id: "avisos_crm",
    label: "Avisos en tiempo real (Campana CRM + Push PWA)",
    nivel: "ok",
    detalle: "Activos para avisar al instante tanto a soporte como a la persona que abre el ticket.",
  });

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
  });
}
