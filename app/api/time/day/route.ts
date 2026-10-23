import { celdasMes, fechaMadrid, kpisMes, mesClave } from "@/lib/time/calendar";
import { replayDia } from "@/lib/time/replay";
import { mapCentro, mapPunch, sesionFichaje } from "@/lib/time/server";

export const runtime = "nodejs";

/** GET ?scope=today|month&month=YYYY-MM&userId= (admin) */
export async function GET(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "today";
  const userId =
    sesion.admin && url.searchParams.get("userId") ? url.searchParams.get("userId")! : sesion.userId;
  const now = new Date();
  const nowIso = now.toISOString();
  const hoy = fechaMadrid(nowIso);
  const month = url.searchParams.get("month") ?? mesClave(now);

  const punchCols =
    "id, user_id, type, at, client_at, mode, work_center_id, lat, lng, accuracy, source, client_id, superseded_by, sequence_ok";

  if (scope === "today") {
    const start = new Date(`${hoy}T00:00:00+01:00`).toISOString();
    const ayerDate = new Date(now);
    ayerDate.setDate(ayerDate.getDate() - 1);
    const ayerYmd = fechaMadrid(ayerDate.toISOString());
    const ayerStart = new Date(`${ayerYmd}T00:00:00+01:00`).toISOString();

    const [centrosRes, festivosRes, rowsRes, ayerRes, pendingRes] = await Promise.all([
      sesion.supabase.from("fichaje_centros").select("*").eq("activo", true),
      sesion.supabase.from("fichaje_festivos").select("fecha"),
      sesion.supabase
        .from("fichaje_punches")
        .select(punchCols)
        .eq("user_id", userId)
        .gte("at", start)
        .order("at", { ascending: true }),
      sesion.supabase
        .from("fichaje_punches")
        .select(punchCols)
        .eq("user_id", userId)
        .gte("at", ayerStart)
        .lt("at", start),
      sesion.supabase
        .from("fichaje_corrections")
        .select("id, date, type, status")
        .eq("user_id", userId)
        .eq("status", "pending"),
    ]);

    void festivosRes;
    const punches = (rowsRes.data ?? []).map((r) => mapPunch(r as Record<string, unknown>));
    const replay = replayDia(punches, nowIso);
    const ayerReplay = replayDia(
      (ayerRes.data ?? []).map((r) => mapPunch(r as Record<string, unknown>)),
      `${ayerYmd}T23:59:59+01:00`
    );

    return Response.json({
      ok: true,
      hoy,
      nowIso,
      centros: (centrosRes.data ?? []).map((c) => mapCentro(c as Record<string, unknown>)),
      punches,
      replay,
      incidenciaAyer: ayerReplay.missingOut ? { date: ayerYmd, type: "out" as const } : null,
      correctionsPending: pendingRes.data ?? [],
    });
  }

  const monthStart = new Date(`${month}-01T00:00:00+01:00`).toISOString();
  const [y, m] = month.split("-").map(Number);
  const next =
    m === 12
      ? new Date(`${y + 1}-01-01T00:00:00+01:00`).toISOString()
      : new Date(`${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+01:00`).toISOString();
  const prevMonth = mesAnterior(month);

  const [centrosRes, festivosRes, rowsRes, resumenRes, corrRes] = await Promise.all([
    sesion.supabase.from("fichaje_centros").select("*").eq("activo", true),
    sesion.supabase.from("fichaje_festivos").select("fecha"),
    sesion.supabase
      .from("fichaje_punches")
      .select(punchCols)
      .eq("user_id", userId)
      .gte("at", monthStart)
      .lt("at", next)
      .order("at", { ascending: true }),
    sesion.supabase
      .from("fichaje_monthly_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("month", prevMonth)
      .maybeSingle(),
    sesion.supabase
      .from("fichaje_corrections")
      .select("*")
      .eq("user_id", userId)
      .gte("date", `${month}-01`)
      .lte("date", diasUltimo(month)),
  ]);

  const festivos = new Set((festivosRes.data ?? []).map((f) => String(f.fecha)));
  const punches = (rowsRes.data ?? []).map((r) => mapPunch(r as Record<string, unknown>));
  const hastaOk = month === mesClave(now) ? hoy : diasUltimo(month);
  const kpisOk = kpisMes(punches, month, hastaOk, festivos, nowIso);
  const celdas = celdasMes(punches, month, hoy, festivos, nowIso);

  return Response.json({
    ok: true,
    month,
    hoy,
    nowIso,
    centros: (centrosRes.data ?? []).map((c) => mapCentro(c as Record<string, unknown>)),
    punches,
    kpis: kpisOk,
    celdas,
    festivos: [...festivos],
    resumenAnterior: resumenRes.data,
    corrections: corrRes.data ?? [],
  });
}

function diasUltimo(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

function mesAnterior(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}
