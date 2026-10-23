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

  const { data: centros } = await sesion.supabase.from("fichaje_centros").select("*").eq("activo", true);
  const { data: festivosRows } = await sesion.supabase.from("fichaje_festivos").select("fecha");
  const festivos = new Set((festivosRows ?? []).map((f) => String(f.fecha)));

  if (scope === "today") {
    const start = new Date(`${hoy}T00:00:00+02:00`).toISOString();
    const { data: rows } = await sesion.supabase
      .from("fichaje_punches")
      .select("*")
      .eq("user_id", userId)
      .gte("at", start)
      .order("at", { ascending: true });
    const punches = (rows ?? []).map((r) => mapPunch(r as Record<string, unknown>));
    const replay = replayDia(punches, nowIso);

    const ayer = new Date(now);
    ayer.setDate(ayer.getDate() - 1);
    const ayerYmd = fechaMadrid(ayer.toISOString());
    const { data: ayerRows } = await sesion.supabase
      .from("fichaje_punches")
      .select("*")
      .eq("user_id", userId)
      .gte("at", `${ayerYmd}T00:00:00+02:00`)
      .lt("at", start);
    const ayerReplay = replayDia(
      (ayerRows ?? []).map((r) => mapPunch(r as Record<string, unknown>)),
      `${ayerYmd}T23:59:59+02:00`
    );

    const { data: pendingCorr } = await sesion.supabase
      .from("fichaje_corrections")
      .select("id, date, type, status")
      .eq("user_id", userId)
      .eq("status", "pending");

    return Response.json({
      ok: true,
      hoy,
      nowIso,
      centros: (centros ?? []).map((c) => mapCentro(c as Record<string, unknown>)),
      punches,
      replay,
      incidenciaAyer: ayerReplay.missingOut
        ? { date: ayerYmd, type: "out" as const }
        : null,
      correctionsPending: pendingCorr ?? [],
    });
  }

  const monthStart = `${month}-01T00:00:00+02:00`;
  const [y, m] = month.split("-").map(Number);
  const next =
    m === 12 ? `${y + 1}-01-01T00:00:00+02:00` : `${y}-${String(m + 1).padStart(2, "0")}-01T00:00:00+02:00`;

  const { data: rows } = await sesion.supabase
    .from("fichaje_punches")
    .select("*")
    .eq("user_id", userId)
    .gte("at", monthStart)
    .lt("at", next)
    .order("at", { ascending: true });

  const punches = (rows ?? []).map((r) => mapPunch(r as Record<string, unknown>));
  const hastaOk = month === mesClave(now) ? hoy : diasUltimo(month);
  const kpisOk = kpisMes(punches, month, hastaOk, festivos, nowIso);
  const celdas = celdasMes(punches, month, hoy, festivos, nowIso);

  const prevMonth = mesAnterior(month);
  const { data: resumenPrev } = await sesion.supabase
    .from("fichaje_monthly_summaries")
    .select("*")
    .eq("user_id", userId)
    .eq("month", prevMonth)
    .maybeSingle();

  const { data: corrections } = await sesion.supabase
    .from("fichaje_corrections")
    .select("*")
    .eq("user_id", userId)
    .gte("date", `${month}-01`)
    .lte("date", diasUltimo(month));

  return Response.json({
    ok: true,
    month,
    hoy,
    nowIso,
    centros: (centros ?? []).map((c) => mapCentro(c as Record<string, unknown>)),
    punches,
    kpis: kpisOk,
    celdas,
    festivos: [...festivos],
    resumenAnterior: resumenPrev,
    corrections: corrections ?? [],
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
