import type { DayPhase, DayReplay, Punch, PunchType } from "./types";

const NINE_H_MS = 9 * 60 * 60 * 1000;

/** Punches activos del día (sin supersedidos), ordenados por hora. */
export function punchesActivos(punches: Punch[]): Punch[] {
  return punches
    .filter((p) => !p.superseded_by)
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function siguienteEstadoValido(phase: DayPhase, type: PunchType): boolean {
  if (type === "in") return phase === "out";
  if (type === "pause_start") return phase === "working";
  if (type === "pause_end") return phase === "paused";
  if (type === "out") return phase === "working" || phase === "paused";
  return false;
}

/**
 * Replay del día: estado, tiempo efectivo (intervalos working) y pausas.
 * `nowIso` cierra el intervalo abierto si sigue trabajando/en pausa.
 */
export function replayDia(punches: Punch[], nowIso: string = new Date().toISOString()): DayReplay {
  const events = punchesActivos(punches);
  let phase: DayPhase = "out";
  let effectiveMs = 0;
  let pauseMs = 0;
  let workOpen: number | null = null;
  let pauseOpen: number | null = null;
  let openSince: string | null = null;
  let lastPunch: Punch | null = null;
  let sequenceOk = true;

  const now = new Date(nowIso).getTime();

  for (const p of events) {
    const t = new Date(p.at).getTime();
    if (!siguienteEstadoValido(phase, p.type)) sequenceOk = false;

    if (phase === "working" && workOpen != null && (p.type === "pause_start" || p.type === "out")) {
      effectiveMs += Math.max(0, t - workOpen);
      workOpen = null;
    }
    if (phase === "paused" && pauseOpen != null && (p.type === "pause_end" || p.type === "out")) {
      pauseMs += Math.max(0, t - pauseOpen);
      pauseOpen = null;
    }

    if (p.type === "in") {
      phase = "working";
      workOpen = t;
      openSince = p.at;
    } else if (p.type === "pause_start") {
      phase = "paused";
      pauseOpen = t;
      openSince = p.at;
    } else if (p.type === "pause_end") {
      phase = "working";
      workOpen = t;
      openSince = p.at;
    } else if (p.type === "out") {
      phase = "out";
      openSince = null;
      workOpen = null;
      pauseOpen = null;
    }
    lastPunch = p;
  }

  if (phase === "working" && workOpen != null) {
    effectiveMs += Math.max(0, now - workOpen);
  }
  if (phase === "paused" && pauseOpen != null) {
    pauseMs += Math.max(0, now - pauseOpen);
  }

  const hadIn = events.some((e) => e.type === "in");
  const hadOut = events.some((e) => e.type === "out");
  const missingOut = hadIn && !hadOut && phase !== "out";

  return {
    phase,
    effectiveMs,
    pauseMs,
    openSince,
    lastPunch,
    events,
    missingOut: missingOut || (hadIn && phase !== "out" && !hadOut),
    overNineHours: effectiveMs > NINE_H_MS,
  };
}

export function formatoDuracion(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

export function formatoRelojCorto(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function etiquetaPunch(type: PunchType): string {
  if (type === "in") return "Entrada";
  if (type === "out") return "Salida";
  if (type === "pause_start") return "Pausa";
  return "Reanudar";
}
