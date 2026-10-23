import { punchesActivos, replayDia } from "./replay";
import type { Punch, PunchMode } from "./types";

/**
 * Modalidad del día: la de la última entrada activa.
 * Así un test temprano en “remote” no pinta todo el viernes como teletrabajo
 * si luego se fichó en oficina.
 */
export function modalidadDia(punches: Punch[]): PunchMode {
  const activos = punchesActivos(punches);
  for (let i = activos.length - 1; i >= 0; i--) {
    if (activos[i].type === "in") return activos[i].mode;
  }
  const last = activos[activos.length - 1];
  return last?.mode ?? "office";
}

const TZ = "Europe/Madrid";
const ORDINARY_DAY_MS = 8 * 60 * 60 * 1000;

export function mesClave(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export function fechaMadrid(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function esFinDeSemana(fechaYmd: string): boolean {
  const [y, m, d] = fechaYmd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(utc);
  return dow === "Sat" || dow === "Sun";
}

export function diasDelMes(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export function laborablesHasta(
  month: string,
  hastaYmd: string,
  festivos: Set<string>
): string[] {
  return diasDelMes(month).filter((f) => {
    if (f > hastaYmd) return false;
    if (esFinDeSemana(f)) return false;
    if (festivos.has(f)) return false;
    return true;
  });
}

export type KpisMes = {
  trabajadasMs: number;
  previstasMs: number;
  extraMs: number;
  remoteDays: number;
  daysWithWork: number;
};

export function kpisMes(
  punches: Punch[],
  month: string,
  hastaYmd: string,
  festivos: Set<string>,
  nowIso: string
): KpisMes {
  const byDay = new Map<string, Punch[]>();
  for (const p of punchesActivos(punches)) {
    const day = fechaMadrid(p.at);
    if (!day.startsWith(month)) continue;
    const list = byDay.get(day) ?? [];
    list.push(p);
    byDay.set(day, list);
  }

  let trabajadasMs = 0;
  let remoteDays = 0;
  let daysWithWork = 0;
  for (const [day, list] of byDay) {
    if (day > hastaYmd) continue;
    const end = day === fechaMadrid(nowIso) ? nowIso : `${day}T23:59:59.999+02:00`;
    const r = replayDia(list, end);
    if (r.effectiveMs <= 0 && list.length === 0) continue;
    if (list.length > 0) {
      daysWithWork += 1;
      trabajadasMs += r.effectiveMs;
      if (modalidadDia(list) === "remote") remoteDays += 1;
    }
  }

  const lab = laborablesHasta(month, hastaYmd, festivos);
  const previstasMs = lab.length * ORDINARY_DAY_MS;
  const extraMs = Math.max(0, trabajadasMs - previstasMs);
  return { trabajadasMs, previstasMs, extraMs, remoteDays, daysWithWork };
}

export type CeldaMes = {
  date: string;
  day: number;
  weekend: boolean;
  holiday: boolean;
  future: boolean;
  effectiveMs: number;
  missingOut: boolean;
  remote: boolean;
  phase: "out" | "working" | "paused" | "empty";
};

export function celdasMes(
  punches: Punch[],
  month: string,
  hoyYmd: string,
  festivos: Set<string>,
  nowIso: string
): CeldaMes[] {
  const byDay = new Map<string, Punch[]>();
  for (const p of punchesActivos(punches)) {
    const day = fechaMadrid(p.at);
    if (!day.startsWith(month)) continue;
    const list = byDay.get(day) ?? [];
    list.push(p);
    byDay.set(day, list);
  }

  return diasDelMes(month).map((date) => {
    const day = Number(date.slice(-2));
    const weekend = esFinDeSemana(date);
    const holiday = festivos.has(date);
    const future = date > hoyYmd;
    const list = byDay.get(date) ?? [];
    if (list.length === 0) {
      return {
        date,
        day,
        weekend,
        holiday,
        future,
        effectiveMs: 0,
        missingOut: false,
        remote: false,
        phase: "empty" as const,
      };
    }
    const end = date === hoyYmd ? nowIso : `${date}T23:59:59.999+02:00`;
    const r = replayDia(list, end);
    return {
      date,
      day,
      weekend,
      holiday,
      future,
      effectiveMs: r.effectiveMs,
      missingOut: r.missingOut,
      remote: modalidadDia(list) === "remote",
      phase: r.phase,
    };
  });
}
