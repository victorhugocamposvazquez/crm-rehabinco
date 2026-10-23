import { fechaMadrid } from "@/lib/time/calendar";
import { replayDia, siguienteEstadoValido } from "@/lib/time/replay";
import { escribirAudit, mapPunch, sesionFichaje } from "@/lib/time/server";
import type { PunchMode, PunchType } from "@/lib/time/types";

export const runtime = "nodejs";

const TIPOS = new Set<PunchType>(["in", "out", "pause_start", "pause_end"]);
const MODOS = new Set<PunchMode>(["office", "remote"]);

export async function POST(request: Request) {
  const sesion = await sesionFichaje();
  if (!sesion) return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    type?: string;
    mode?: string;
    workCenterId?: string | null;
    clientAt?: string | null;
    clientId?: string | null;
    lat?: number | null;
    lng?: number | null;
    accuracy?: number | null;
    source?: string | null;
  } | null;

  const type = body?.type as PunchType | undefined;
  const mode = (body?.mode ?? "office") as PunchMode;
  if (!type || !TIPOS.has(type) || !MODOS.has(mode)) {
    return Response.json({ ok: false, error: "Datos de fichaje no válidos." }, { status: 400 });
  }

  const clientId = body?.clientId?.trim() || null;
  if (clientId) {
    const { data: prev } = await sesion.supabase
      .from("fichaje_punches")
      .select("*")
      .eq("user_id", sesion.userId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (prev) {
      return Response.json({ ok: true, punch: mapPunch(prev as Record<string, unknown>), idempotent: true });
    }
  }

  const now = new Date();
  const dayStart = `${fechaMadrid(now.toISOString())}T00:00:00.000`;
  const { data: hoyRows } = await sesion.supabase
    .from("fichaje_punches")
    .select("*")
    .eq("user_id", sesion.userId)
    .gte("at", new Date(`${dayStart}+02:00`).toISOString())
    .order("at", { ascending: true });

  const punches = (hoyRows ?? []).map((r) => mapPunch(r as Record<string, unknown>));
  const estado = replayDia(punches, now.toISOString());
  const sequenceOk = siguienteEstadoValido(estado.phase, type);

  const source = (body?.source?.trim() || "pwa").slice(0, 80);
  const row = {
    user_id: sesion.userId,
    type,
    at: now.toISOString(),
    client_at: body?.clientAt ?? null,
    mode,
    work_center_id: mode === "office" ? body?.workCenterId ?? null : null,
    lat: body?.lat ?? null,
    lng: body?.lng ?? null,
    accuracy: body?.accuracy ?? null,
    source,
    client_id: clientId,
    sequence_ok: sequenceOk,
  };

  const { data: inserted, error } = await sesion.supabase.from("fichaje_punches").insert(row).select("*").single();
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  await escribirAudit(sesion.supabase, {
    actorId: sesion.userId,
    actorLabel: sesion.nombre,
    action: type,
    detail: `${type} · ${mode}${sequenceOk ? "" : " · secuencia irregular"}`,
    origin: source,
  });

  return Response.json({
    ok: true,
    punch: mapPunch(inserted as Record<string, unknown>),
    sequenceOk,
  });
}
