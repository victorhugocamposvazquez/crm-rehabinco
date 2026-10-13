"use client";

import React from "react";
import Link from "next/link";
import type { Environment, EnvironmentItem } from "../../lib/avm/types";
import { fmtNumero } from "../../lib/avm/ui/format";
import {
  avisoEntornoVacio,
  fmtCapaEntorno,
  type EntornoCoverage,
  type AvisoEntornoVacio,
} from "../../lib/avm/entorno-coverage";
import {
  AlertTriangle,
  Bus,
  Car,
  Construction,
  Factory,
  Fuel,
  GraduationCap,
  HeartPulse,
  Info,
  Minus,
  Pill,
  Plus,
  Shield,
  ShoppingCart,
  Siren,
  Store,
  TrainFront,
  Trees,
  Umbrella,
  Volume2,
  Waves,
  Wine,
  Zap,
  type LucideIcon,
} from "lucide-react";

function palabraEntorno(score: number): string {
  if (score >= 80) return "muy bueno";
  if (score >= 60) return "bueno";
  if (score >= 40) return "normal";
  return "flojo";
}

/** Misma categoría que el prototipo (`valorador.html`): bus, carrito, colegio, escudo, sirena… */
const ICONO_POR_CLAVE: Record<string, LucideIcon> = {
  bus: Bus,
  gtfs_stop: Bus,
  rail: TrainFront,
  railway: TrainFront,
  supermarket: ShoppingCart,
  cart: ShoppingCart,
  shop: Store,
  store: Store,
  daily_services: Store,
  school: GraduationCap,
  health: HeartPulse,
  health_center: HeartPulse,
  park: Trees,
  beach: Umbrella,
  pharmacy: Pill,
  noise: Volume2,
  nightlife: Wine,
  main_road: Car,
  traffic: Car,
  fuel: Fuel,
  power_line: Zap,
  industrial: Factory,
  flood: Waves,
  vulnerable_section: Shield,
  shield: Shield,
  crime_municipality: Siren,
  siren: Siren,
  works: Construction,
  zone_mark: Construction,
};

const AMENIDAD = new Set([
  "bus",
  "gtfs_stop",
  "rail",
  "supermarket",
  "shop",
  "store",
  "daily_services",
  "school",
  "health",
  "health_center",
  "park",
  "beach",
  "pharmacy",
]);

const RIESGO_MUNICIPAL = new Set(["flood", "vulnerable_section", "crime_municipality", "air_station", "zone_mark"]);

function clavesDe(item: EnvironmentItem): string[] {
  const [layer, category] = item.indicator.split(":");
  const desdeEtiqueta: string[] = [];
  const t = item.label.toLowerCase();
  if (/colegio|escuela|centro docente/.test(t)) desdeEtiqueta.push("school");
  if (/supermercado/.test(t)) desdeEtiqueta.push("supermarket");
  if (/farmacia/.test(t)) desdeEtiqueta.push("pharmacy");
  if (/parada de bus|buses/.test(t)) desdeEtiqueta.push("bus");
  if (/parque|zona verde/.test(t)) desdeEtiqueta.push("park");
  if (/playa/.test(t)) desdeEtiqueta.push("beach");
  if (/gasolinera/.test(t)) desdeEtiqueta.push("fuel");
  if (/vía principal|via principal/.test(t)) desdeEtiqueta.push("main_road");
  if (/vía férrea|via ferrea|tren|metro/.test(t)) desdeEtiqueta.push("railway");
  if (/alta tensión|alta tension/.test(t)) desdeEtiqueta.push("power_line");
  if (/ocio nocturno/.test(t)) desdeEtiqueta.push("nightlife");
  if (/industrial/.test(t)) desdeEtiqueta.push("industrial");
  if (/ruido/.test(t)) desdeEtiqueta.push("noise");
  if (/inund/.test(t)) desdeEtiqueta.push("flood");
  if (/vulnerable/.test(t)) desdeEtiqueta.push("vulnerable_section");
  if (/criminalidad/.test(t)) desdeEtiqueta.push("crime_municipality");
  if (/centro de salud|sanitari/.test(t)) desdeEtiqueta.push("health");
  if (/comercio/.test(t)) desdeEtiqueta.push("store");
  return [category, layer, ...desdeEtiqueta].filter((k): k is string => Boolean(k));
}

function iconoItem(item: EnvironmentItem, variant: "good" | "bad" | "info" | "warn"): LucideIcon {
  for (const clave of clavesDe(item)) {
    const ico = ICONO_POR_CLAVE[clave];
    if (ico) return ico;
  }
  if (variant === "good") return Plus;
  if (variant === "bad") return Minus;
  if (variant === "warn") return AlertTriangle;
  return Info;
}

function esRiesgoMunicipal(item: EnvironmentItem): boolean {
  const claves = clavesDe(item);
  return claves.some((c) => RIESGO_MUNICIPAL.has(c));
}

function esAmenidad(item: EnvironmentItem): boolean {
  return clavesDe(item).some((c) => AMENIDAD.has(c));
}

function muestraDistancia(item: EnvironmentItem): boolean {
  if (item.distanceM == null || item.distanceM <= 0) return false;
  if (esRiesgoMunicipal(item) && !item.indicator.startsWith("air_station")) return false;
  return true;
}

function introCerca(items: EnvironmentItem[]): string {
  const hayColegio = items.some((i) => clavesDe(i).includes("school"));
  const hayVia = items.some((i) => clavesDe(i).includes("main_road"));
  if (hayColegio && hayVia) {
    return "No son riesgos. El colegio está demasiado lejos para sumar puntos, y la vía principal demasiado lejos para restar.";
  }
  return "No son riesgos. Están en el radio y no han sumado ni restado puntos a la nota del entorno.";
}

function glosaCerca(item: EnvironmentItem): string {
  if (esAmenidad(item)) return "Está en el radio, pero demasiado lejos para sumar puntos a la nota del entorno.";
  return "Está en el radio, pero demasiado lejos o es demasiado leve para restar puntos.";
}

function glosaRiesgo(item: EnvironmentItem): string | null {
  const claves = clavesDe(item);
  if (claves.includes("vulnerable_section")) {
    return item.sense === "info"
      ? "La sección censal de este inmueble no figura en ese catálogo."
      : "La sección censal de este inmueble figura en ese catálogo. Es un aviso: no resta puntos ni cambia el precio.";
  }
  if (claves.includes("crime_municipality")) return "Dato del municipio entero, no de la calle. No cambia el precio.";
  if (claves.includes("flood")) {
    return item.sense === "info"
      ? "El punto no cae en una zona inundable cartografiada."
      : "El punto cae dentro de una zona inundable. Es un aviso: no resta puntos ni cambia el precio.";
  }
  if (claves.includes("zone_mark")) return "Aviso del equipo. No cambia el precio.";
  return null;
}

function FilaEntorno({
  item,
  variant,
  glosa,
  badge,
}: {
  item: EnvironmentItem;
  variant: "good" | "bad" | "info" | "warn";
  glosa?: string | null;
  badge?: string;
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
  const etiqueta = badge ?? (variant === "warn" ? "aviso" : variant === "info" ? "info" : null);

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${bg}`}>
        <Ico className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">{item.label}</p>
        {glosa ? <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-2)]">{glosa}</p> : null}
        <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
          {muestraDistancia(item) && item.distanceM != null ? `a ${fmtNumero(item.distanceM)} m · ` : ""}
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
      ) : etiqueta ? (
        <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-3)]">
          {etiqueta}
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
  const yLine = 77;
  const arriba = conDist
    .filter((it) => it.sense === "positive" || (typeof it.value === "number" && it.value > 0))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
  const abajo = conDist
    .filter((it) => !(it.sense === "positive" || (typeof it.value === "number" && it.value > 0)))
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

  function puestos(lista: EnvironmentItem[], dir: "up" | "down") {
    let lastX = -99;
    let row = 0;
    return lista.map((it) => {
      const d = it.distanceM ?? 0;
      const x = 40 + ((W - 80) * Math.min(d, maxD)) / maxD;
      row = x - lastX < 36 ? (row + 1) % 2 : 0;
      lastX = x;
      const y = dir === "up" ? yLine - (28 + row * 26) : yLine + (36 + row * 26);
      return { it, x, y };
    });
  }

  const marcas = [...puestos(arriba, "up"), ...puestos(abajo, "down")];

  return (
    <div className="relative mb-3 mt-1 h-[154px] w-full" role="img" aria-label="Elementos del entorno por distancia">
      <svg viewBox={`0 0 ${W} 154`} className="absolute inset-0 h-full w-full">
        <line x1="40" y1={yLine} x2={W - 40} y2={yLine} stroke="var(--border)" strokeWidth="2" />
        {[0, 100, 200, 300, 400, 500, 600].map((m) => {
          const x = 40 + ((W - 80) * m) / maxD;
          return (
            <g key={m}>
              <line x1={x} y1={yLine - 7} x2={x} y2={yLine + 7} stroke="var(--border)" />
              <text x={x} y={yLine + 20} textAnchor="middle" fontSize="10" fill="var(--text-3)">
                {m === 0 ? "portal" : m === 600 ? "600 m +" : m}
              </text>
            </g>
          );
        })}
        <circle cx="40" cy={yLine} r="5" fill="var(--foreground)" />
        {marcas.map(({ it, x, y }) => (
          <line
            key={`g-${it.label}`}
            x1={x}
            y1={yLine}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeDasharray="2 3"
          />
        ))}
      </svg>
      {marcas.map(({ it, x, y }) => {
        const favorable = it.sense === "positive" || (typeof it.value === "number" && it.value > 0);
        const Ico = iconoItem(it, favorable ? "good" : "bad");
        return (
          <span
            key={`i-${it.label}`}
            title={`${it.label}${it.distanceM != null ? ` · a ${fmtNumero(it.distanceM)} m` : ""}`}
            className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ${
              favorable
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            }`}
            style={{ left: `${(x / W) * 100}%`, top: y }}
          >
            <Ico className="h-3.5 w-3.5" aria-hidden />
          </span>
        );
      })}
    </div>
  );
}

function AvisoVacio({ aviso }: { aviso: AvisoEntornoVacio }) {
  if (aviso.kind === "sin_capas") {
    return (
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-[13px] leading-snug text-[var(--text-2)]">
        <p>
          Capas de entorno no cargadas para <b>{aviso.municipalityLabel}</b>. Ejecuta los cargadores de{" "}
          <code className="text-[12px]">scripts/env-load/</code> (ver README) y{" "}
          <b>revalora</b> el inmueble; el entorno se calcula al valorar, no al abrir el informe.
        </p>
        <p className="mt-2">
          <Link href="/valoraciones/metodologia#entorno-capas" className="text-accent underline underline-offset-2">
            Cómo valoramos · Entorno · capas públicas
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-3 text-[13px] leading-snug text-[var(--text-2)]">
      <p className="font-medium">Sin elementos de entorno a menos de 600 m</p>
      <p className="mt-1 text-[12px] text-[var(--text-3)]">
        Capas consultadas en la valoración (fecha de carga en Supabase):
      </p>
      {aviso.layers.length ? (
        <ul className="mt-2 space-y-1 text-[12px] text-[var(--text-3)]">
          {aviso.layers.map((c) => (
            <li key={`${c.layer}-${c.source}`}>
              {fmtCapaEntorno(c.layer)} · {c.source}
              {c.loaded_at ? (
                <span className="tabular-nums">
                  {" "}
                  · {new Date(c.loaded_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] text-[var(--text-3)]">No hay capas geográficas registradas cerca de este punto.</p>
      )}
    </div>
  );
}

export function EntornoInforme({
  environment,
  coverage,
  municipalityLabel = "este municipio",
}: {
  environment: Environment | null;
  coverage?: EntornoCoverage | null;
  municipalityLabel?: string;
}) {
  const sinPuntuables =
    !environment ||
    (!environment.positives.length &&
      !environment.negatives.length &&
      !(environment.flags?.length ?? 0));
  const aviso = sinPuntuables ? avisoEntornoVacio(environment, coverage ?? null, municipalityLabel) : null;
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
      {aviso ? <AvisoVacio aviso={aviso} /> : null}
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
      {!sinPuntuables ? (
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
            {positivos.map((p) => (
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
  const riesgos = flags.filter(esRiesgoMunicipal);
  const cerca = flags.filter((f) => !esRiesgoMunicipal(f));
  return (
    <div className="flex flex-col gap-4" data-testid="entorno-flags">
      {riesgos.length ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Del barrio y del municipio</p>
          <p className="mb-2 text-[12px] leading-snug text-[var(--text-3)]">
            No cambian el precio. Dicen si la sección censal está en un catálogo de riesgo y cómo está el municipio.
          </p>
          <div className="flex flex-col gap-2">
            {riesgos.map((f) => (
              <FilaEntorno
                key={f.label}
                item={f}
                variant={f.sense === "negative" ? "warn" : "info"}
                glosa={glosaRiesgo(f)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {cerca.length ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Cerca, pero fuera de la nota</p>
          <p className="mb-2 text-[12px] leading-snug text-[var(--text-3)]">{introCerca(cerca)}</p>
          <div className="flex flex-col gap-2">
            {cerca.map((f) => (
              <FilaEntorno
                key={f.label}
                item={f}
                variant={esAmenidad(f) ? "good" : "warn"}
                glosa={glosaCerca(f)}
                badge="sin puntos"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
