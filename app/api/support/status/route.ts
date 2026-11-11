import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupportProjectManifest } from "@/lib/support/project-manifest";
import { obtenerOCrearAjustesProyecto, obtenerUsuarioSesionSoporte } from "@/lib/support/service";
import { empresaTieneSoporteActivo, esTicketAbierto, requiereConfirmacionUsuario, type SupportEstado } from "@/lib/support/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await obtenerUsuarioSesionSoporte();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sesión requerida." }, { status: 401 });
  }

  const manifest = getSupportProjectManifest();
  const settings = await obtenerOCrearAjustesProyecto(manifest.projectKey);
  const evaluacion = empresaTieneSoporteActivo(settings);
  const activo = user.isSuperadmin || evaluacion.activo;

  const admin = createAdminClient();
  const query = admin
    .from("support_tickets")
    .select("estado")
    .eq("project_key", manifest.projectKey);

  const { data: filas } = user.isSuperadmin
    ? await query
    : await query.eq("user_id", user.id);

  let abiertosCount = 0;
  let esperandoConfirmacionCount = 0;
  for (const fila of filas ?? []) {
    const est = fila.estado as SupportEstado;
    if (esTicketAbierto(est)) abiertosCount += 1;
    if (!user.isSuperadmin && requiereConfirmacionUsuario(est)) {
      esperandoConfirmacionCount += 1;
    }
    if (user.isSuperadmin && (est === "nuevo" || est === "reabierto" || est === "escalado_humano" || est === "pr_revision")) {
      esperandoConfirmacionCount += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    activo,
    motivo: activo ? null : evaluacion.motivo,
    empresaNombre: settings.empresa_nombre,
    projectKey: manifest.projectKey,
    abiertosCount,
    esperandoConfirmacionCount,
  });
}
