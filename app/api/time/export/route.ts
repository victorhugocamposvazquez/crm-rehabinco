import { kpisMes, mesClave } from "@/lib/time/calendar";
import { csvAudit, csvPunches, pdfResumenMes, zipInspeccion } from "@/lib/time/export";
import { mapPunch, escribirAudit, sesionFichaje } from "@/lib/time/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion?.admin) return Response.json({ ok: false, error: "Solo administración." }, { status: 403 });

  const month = new URL(request.url).searchParams.get("month") ?? mesClave(new Date());
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ ok: false, error: "Mes no válido." }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01T00:00:00+02:00`;
  const next =
    m === 12 ? `${y + 1}-01-01T00:00:00+02:00` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+02:00`;

  const { data: profiles } = await sesion.supabase
    .from("profiles")
    .select("id, nombre_completo, activo, role")
    .eq("activo", true)
    .in("role", ["superadmin", "admin", "comercial", "agente"]);

  const { data: punchesRaw } = await sesion.supabase
    .from("fichaje_punches")
    .select("*")
    .gte("at", start)
    .lt("at", next)
    .order("at", { ascending: true });

  const { data: centros } = await sesion.supabase.from("fichaje_centros").select("id, name");
  const centroNombre = new Map((centros ?? []).map((c) => [String(c.id), String(c.name)]));
  const nombreDe = new Map((profiles ?? []).map((p) => [String(p.id), String(p.nombre_completo ?? p.id)]));

  const punches = (punchesRaw ?? []).map((r) => {
    const p = mapPunch(r as Record<string, unknown>);
    return {
      ...p,
      nombre: nombreDe.get(p.user_id) ?? p.user_id,
      centro: p.work_center_id ? centroNombre.get(p.work_center_id) ?? p.work_center_id : null,
    };
  });

  const { data: festivosRows } = await sesion.supabase.from("fichaje_festivos").select("fecha");
  const festivos = new Set((festivosRows ?? []).map((f) => String(f.fecha)));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hasta = `${month}-${String(lastDay).padStart(2, "0")}`;

  const personas = (profiles ?? []).map((prof) => {
    const userPunches = punches.filter((p) => p.user_id === prof.id);
    const k = kpisMes(userPunches, month, hasta, festivos, new Date().toISOString());
    return {
      nombre: String(prof.nombre_completo ?? prof.id),
      days: k.daysWithWork,
      ordinaryMin: Math.round(k.trabajadasMs / 60_000) - Math.round(k.extraMs / 60_000),
      extraMin: Math.round(k.extraMs / 60_000),
      remoteDays: k.remoteDays,
      signedAt: null as string | null,
    };
  });

  const { data: summaries } = await sesion.supabase
    .from("fichaje_monthly_summaries")
    .select("user_id, signed_at")
    .eq("month", month);
  for (const s of summaries ?? []) {
    const persona = personas.find((p) => nombreDe.get(String(s.user_id)) === p.nombre);
    if (persona) persona.signedAt = s.signed_at;
  }

  const { data: audit } = await sesion.supabase
    .from("fichaje_audit_log")
    .select("at, actor_label, action, detail, origin")
    .gte("at", start)
    .lt("at", next)
    .order("at", { ascending: true });

  const pdfBytes = pdfResumenMes({ month, personas });
  const zip = await zipInspeccion({
    month,
    punchesCsv: csvPunches(punches),
    auditCsv: csvAudit(audit ?? []),
    pdfBytes,
  });

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: "exportacion",
    detail: `Exportación Inspección ${month}`,
    origin: "panel-admin",
  });

  return new Response(Buffer.from(zip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="inspeccion_jornada_${month}.zip"`,
    },
  });
}
