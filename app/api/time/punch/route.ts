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
  const now = new Date();
  const nowIso = now.toISOString();
  const hoy = fechaMadrid(nowIso);
  // Ventana del día civil en Madrid (±14 h de margen DST).
  const dayStartIso = new Date(`${hoy}T00:00:00+01:00`).toISOString();

  const selectPunch =
    "id, user_id, type, at, client_at, mode, work_center_id, lat, lng, accuracy, source, client_id, superseded_by, sequence_ok";

  const [prevRes, hoyRes] = await Promise.all([
    clientId
      ? sesion.supabase
          .from("fichaje_punches")
          .select(selectPunch)
          .eq("user_id", sesion.userId)
          .eq("client_id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null as Record<string, unknown> | null }),
    sesion.supabase
      .from("fichaje_punches")
      .select(selectPunch)
      .eq("user_id", sesion.userId)
      .gte("at", dayStartIso)
      .order("at", { ascending: true }),
  ]);

  if (prevRes.data) {
    return Response.json({
      ok: true,
      punch: mapPunch(prevRes.data as Record<string, unknown>),
      idempotent: true,
    });
  }

  const punches = (hoyRes.data ?? []).map((r) => mapPunch(r as Record<string, unknown>));
  const estado = replayDia(punches, nowIso);
  const sequenceOk = siguienteEstadoValido(estado.phase, type);

  const source = (body?.source?.trim() || "pwa").slice(0, 80);
  const row = {
    user_id: sesion.userId,
    type,
    at: nowIso,
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

  const { data: inserted, error } = await sesion.supabase
    .from("fichaje_punches")
    .insert(row)
    .select(selectPunch)
    .single();
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  // No bloquear la respuesta del fichaje.
  void escribirAudit(sesion.supabase, {
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
