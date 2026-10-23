import { fechaMadrid, kpisMes, mesClave } from "@/lib/time/calendar";
import { replayDia } from "@/lib/time/replay";
import { mapPunch, sesionFichaje } from "@/lib/time/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion?.admin) return Response.json({ ok: false, error: "Solo administración." }, { status: 403 });

  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? mesClave(new Date());
  const nowIso = new Date().toISOString();
  const hoy = fechaMadrid(nowIso);

  const { data: profiles } = await sesion.supabase
    .from("profiles")
    .select("id, nombre_completo, color, role, activo")
    .eq("activo", true)
    .in("role", ["superadmin", "admin", "comercial", "agente"])
    .order("nombre_completo");

  const startHoy = `${hoy}T00:00:00+02:00`;
  const { data: punchesHoy } = await sesion.supabase
    .from("fichaje_punches")
    .select("*")
    .gte("at", startHoy)
    .order("at", { ascending: true });

  const [y, m] = month.split("-").map(Number);
  const monthStart = `${month}-01T00:00:00+02:00`;
  const next =
    m === 12 ? `${y + 1}-01-01T00:00:00+02:00` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+02:00`;
  const { data: punchesMes } = await sesion.supabase
    .from("fichaje_punches")
    .select("*")
    .gte("at", monthStart)
    .lt("at", next);

  const { data: corrections } = await sesion.supabase
    .from("fichaje_corrections")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  const { data: audit } = await sesion.supabase
    .from("fichaje_audit_log")
    .select("*")
    .order("at", { ascending: false })
    .limit(100);

  const { data: protocolo } = await sesion.supabase.from("fichaje_protocolo").select("*").eq("id", 1).maybeSingle();
  const { data: festivosRows } = await sesion.supabase.from("fichaje_festivos").select("fecha");
  const festivos = new Set((festivosRows ?? []).map((f) => String(f.fecha)));
  const { data: summaries } = await sesion.supabase
    .from("fichaje_monthly_summaries")
    .select("*")
    .eq("month", month);

  const byUserHoy = new Map<string, ReturnType<typeof mapPunch>[]>();
  for (const r of punchesHoy ?? []) {
    const p = mapPunch(r as Record<string, unknown>);
    const list = byUserHoy.get(p.user_id) ?? [];
    list.push(p);
    byUserHoy.set(p.user_id, list);
  }
  const byUserMes = new Map<string, ReturnType<typeof mapPunch>[]>();
  for (const r of punchesMes ?? []) {
    const p = mapPunch(r as Record<string, unknown>);
    const list = byUserMes.get(p.user_id) ?? [];
    list.push(p);
    byUserMes.set(p.user_id, list);
  }

  let working = 0;
  let paused = 0;
  let out = 0;
  let sinFichar = 0;
  const team = (profiles ?? []).map((prof) => {
    const list = byUserHoy.get(String(prof.id)) ?? [];
    const replay = replayDia(list, nowIso);
    if (list.length === 0) sinFichar += 1;
    else if (replay.phase === "working") working += 1;
    else if (replay.phase === "paused") paused += 1;
    else out += 1;
    const mesList = byUserMes.get(String(prof.id)) ?? [];
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const hasta = month === mesClave(new Date()) ? hoy : `${month}-${String(last).padStart(2, "0")}`;
    const kpis = kpisMes(mesList, month, hasta, festivos, nowIso);
    const summary = (summaries ?? []).find((s) => s.user_id === prof.id);
    return {
      id: prof.id,
      nombre: prof.nombre_completo ?? "Sin nombre",
      color: prof.color,
      phase: list.length === 0 ? "absent" : replay.phase,
      replay,
      punchesHoy: list,
      punchesMes: mesList,
      kpis,
      signedAt: summary?.signed_at ?? null,
      extraCompensation: summary?.extra_compensation ?? null,
    };
  });

  return Response.json({
    ok: true,
    hoy,
    month,
    nowIso,
    counts: { working, paused, out, sinFichar },
    team,
    corrections: corrections ?? [],
    audit: audit ?? [],
    protocolo,
    festivos: [...festivos],
  });
}
