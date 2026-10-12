"use client";

import React from "react";
import type { Environment, EnvironmentItem } from "../../lib/avm/types";
import { fmtNumero } from "../../lib/avm/ui/format";
import {
  Bus,
  Store,
  GraduationCap,
  HeartPulse,
  Volume2,
  Waves,
  Construction,
  Info,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-react";

function palabraEntorno(score: number): string {
  if (score >= 80) return "muy bueno";
  if (score >= 60) return "bueno";
  if (score >= 40) return "normal";
  return "flojo";
}

function iconoItem(item: EnvironmentItem, variant: "good" | "bad" | "info" | "warn") {
  const cat = item.indicator;
  const map: Record<string, typeof Bus> = {
    gtfs_stop: Bus,
    school: GraduationCap,
    health: HeartPulse,
    osm_poi: Store,
    noise: Volume2,
    flood: Waves,
    works: Construction,
  };
  const Ico = map[cat] ?? (variant === "good" ? Plus : variant === "bad" ? Minus : variant === "warn" ? AlertTriangle : Info);
  return Ico;
}

function FilaEntorno({
  item,
  variant,
}: {
  item: EnvironmentItem;
  variant: "good" | "bad" | "info" | "warn";
}) {
  const Ico = iconoItem(item, variant);
  const pts = typeof item.value === "number" ? item.value : null;
  const bg =
    variant === "good"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : variant === "bad"
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : variant === "warn"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-blue-500/10 text-blue-600 dark:text-blue-400";

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${bg}`}>
        <Ico className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">{item.label}</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
          {item.distanceM != null ? `a ${fmtNumero(item.distanceM)} m · ` : ""}
          {item.source}
        </p>
      </div>
      {pts != null && pts !== 0 ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
            pts > 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
          }`}
        >
          {pts > 0 ? "+" : "−"}
          {Math.abs(pts)}
        </span>
      ) : variant === "warn" || variant === "info" ? (
        <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-3)]">
          {variant === "warn" ? "aviso" : "info"}
        </span>
      ) : null}
    </div>
  );
}

function ReglaDistancias({ items }: { items: EnvironmentItem[] }) {
  const conDist = items.filter((i) => i.distanceM != null && i.distanceM <= 600);
  if (conDist.length < 2) return null;
  const W = 600;
  const maxD = 600;
  return (
    <svg viewBox={`0 0 ${W} 154`} className="mb-3 mt-1 block w-full" role="img" aria-label="Elementos del entorno por distancia">
      <line x1="40" y1="77" x2={W - 40} y2="77" stroke="var(--border)" strokeWidth="2" />
      {[0, 100, 200, 300, 400, 500, 600].map((m) => {
        const x = 40 + ((W - 80) * m) / maxD;
        return (
          <g key={m}>
            <line x1={x} y1="70" x2={x} y2="84" stroke="var(--border)" />
            <text x={x} y="98" textAnchor="middle" fontSize="10" fill="var(--text-3)">
              {m}
            </text>
          </g>
        );
      })}
      {conDist.map((it, i) => {
        const d = it.distanceM ?? 0;
        const x = 40 + ((W - 80) * Math.min(d, maxD)) / maxD;
        const arriba = it.sense === "positive" || (typeof it.value === "number" && it.value > 0);
        const y = arriba ? 52 : 102;
        const color = arriba ? "#4ade80" : "#f87171";
        return <circle key={`${it.label}-${i}`} cx={x} cy={y} r="5" fill={color} />;
      })}
    </svg>
  );
}

export function EntornoInforme({ environment }: { environment: Environment | null }) {
  const vacio = !environment || (!environment.positives.length && !environment.negatives.length && !environment.flags.length);
  const score = environment?.score ?? 0;
  const positivos = [...(environment?.positives ?? [])].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const todos = [...(environment?.positives ?? []), ...(environment?.negatives ?? [])];

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5" data-testid="entorno">
      <div className="mb-3 flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Entorno</h2>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-3)]">
          no cambia el precio en fase 1
        </span>
      </div>
      <p className="mb-3 text-[12px] leading-snug text-[var(--text-3)]">
        Cada fila lleva icono por tipo (transporte, comercio, salud, ruido…), insignia de puntos si aplica y la fuente con fecha de carga del dato.
      </p>
      {vacio ? (
        <p className="mb-3 text-[13px] text-[var(--text-3)]">
          Aún no hay capas de entorno cerca de este punto (OSM/GTFS en carga o valoración anterior). Revalora tras cargar
          datos o espera unos segundos si acabas de abrir el informe.
        </p>
      ) : null}
      {environment?.score != null ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-4">
          <p className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums">{environment.score}</p>
          <div className="relative h-2 min-w-[120px] flex-1 rounded bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500">
            <i
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--surface)] bg-foreground"
              style={{ left: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <span className="text-[13px] whitespace-nowrap text-[var(--text-3)]">{palabraEntorno(score)}</span>
        </div>
      ) : null}
      {!vacio ? (
        <>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">A tu alrededor</p>
      <ReglaDistancias items={todos} />
      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-[var(--text-3)]">
        <span>
          <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 align-middle" />
          a favor, encima de la línea
        </span>
        <span>
          <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-red-500 align-middle" />
          en contra, debajo
        </span>
        <span className="text-[var(--text-3)]">distancia en metros desde el portal</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">A favor</p>
          <div className="flex flex-col gap-2">
            {positivos.slice(0, 6).map((p) => (
              <FilaEntorno key={p.label} item={p} variant="good" />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">En contra</p>
          <div className="flex flex-col gap-2">
            {(environment?.negatives ?? []).map((p) => (
              <FilaEntorno key={p.label} item={p} variant="bad" />
            ))}
          </div>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
}

export function FlagsEntorno({ flags }: { flags: EnvironmentItem[] }) {
  if (!flags.length) {
    return <p className="text-[13px] text-[var(--text-3)]">Sin avisos del equipo en esta zona</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {flags.map((f) => (
        <FilaEntorno key={f.label} item={f} variant={f.sense === "negative" ? "warn" : "info"} />
      ))}
    </div>
  );
}
