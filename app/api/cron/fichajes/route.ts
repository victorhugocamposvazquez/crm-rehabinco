import { publicarAviso } from "@/lib/alertas/publicar";
import { createAdminClient } from "@/lib/supabase/admin";
import { fechaMadrid, kpisMes, mesClave } from "@/lib/time/calendar";
import { mapPunch } from "@/lib/time/server";
import { replayDia } from "@/lib/time/replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function ejecutar(request: Request): Promise<Response> {
  if (!autorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const hoy = fechaMadrid(nowIso);
  const hourMadrid = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(now)
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nombre_completo, activo, role")
    .eq("activo", true)
    .in("role", ["superadmin", "admin", "comercial", "agente"]);

  const { data: festivosRows } = await admin.from("fichaje_festivos").select("fecha");
  const festivos = new Set((festivosRows ?? []).map((f) => String(f.fecha)));

  const incidencias: Array<{ userId: string; date: string }> = [];

  // Incidencias sin OUT: revisar ayer en franja nocturna / siempre en cron diario
  const ayerDate = new Date(now);
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = fechaMadrid(ayerDate.toISOString());
  const esLaborable =
    !festivos.has(ayer) &&
    !["Sat", "Sun"].includes(
      new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", weekday: "short" }).format(ayerDate)
    );

  if (esLaborable && hourMadrid >= 0) {
    for (const prof of profiles ?? []) {
      const { data: rows } = await admin
        .from("fichaje_punches")
        .select("*")
        .eq("user_id", prof.id)
        .gte("at", `${ayer}T00:00:00+02:00`)
        .lt("at", `${hoy}T00:00:00+02:00`);
      const punches = (rows ?? []).map((r) => mapPunch(r as Record<string, unknown>));
      if (punches.length === 0) continue;
      const r = replayDia(punches, `${ayer}T23:59:59+02:00`);
      if (r.missingOut) {
        incidencias.push({ userId: String(prof.id), date: ayer });
        await admin.from("fichaje_audit_log").insert({
          actor_id: null,
          actor_label: "Servidor",
          action: "incidencia",
          detail: `${prof.nombre_completo ?? prof.id} sin salida el ${ayer}`,
          origin: "servidor",
        });
        try {
          await publicarAviso({
            userId: String(prof.id),
            clave: `fichaje:sin-salida:${ayer}`,
            titulo: "Falta la salida de ayer",
            cuerpo: `No registraste la salida el ${ayer}. Corrígela desde Fichaje.`,
            url: "/fichaje",
            canal: "agenda",
          });
        } catch {
          // El audit ya quedó; el push no debe tumbar el cron.
        }
      }
    }
  }

  // Día 1: generar resúmenes del mes anterior
  const dayOfMonth = Number(hoy.slice(-2));
  let summaries = 0;
  if (dayOfMonth === 1 || new URL(request.url).searchParams.get("forceSummaries") === "1") {
    const prev = mesAnterior(mesClave(now));
    const [py, pm] = prev.split("-").map(Number);
    const start = `${prev}-01T00:00:00+02:00`;
    const next =
      pm === 12 ? `${py + 1}-01-01T00:00:00+02:00` : `${py}-${String(pm + 1).padStart(2, "0")}-01T00:00:00+02:00`;
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    const hasta = `${prev}-${String(last).padStart(2, "0")}`;

    for (const prof of profiles ?? []) {
      const { data: rows } = await admin
        .from("fichaje_punches")
        .select("*")
        .eq("user_id", prof.id)
        .gte("at", start)
        .lt("at", next);
      const punches = (rows ?? []).map((r) => mapPunch(r as Record<string, unknown>));
      const k = kpisMes(punches, prev, hasta, festivos, nowIso);
      const ordinaryMin = Math.max(0, Math.round(k.trabajadasMs / 60_000) - Math.round(k.extraMs / 60_000));
      const { error } = await admin.from("fichaje_monthly_summaries").upsert(
        {
          user_id: prof.id,
          month: prev,
          days: k.daysWithWork,
          ordinary_min: ordinaryMin,
          extra_min: Math.round(k.extraMs / 60_000),
          remote_days: k.remoteDays,
          generated_at: nowIso,
        },
        { onConflict: "user_id,month" }
      );
      if (!error) summaries += 1;
    }
  }

  return Response.json({ ok: true, incidencias: incidencias.length, summaries, hoy });
}

function mesAnterior(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
