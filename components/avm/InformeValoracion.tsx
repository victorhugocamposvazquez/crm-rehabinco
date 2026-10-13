import React from "react";
import type { SourceUsed, Twin, ValuationResult } from "../../lib/avm/types";
import { computeConfidence } from "../../lib/avm/confidence";
import { filasFicha } from "../../lib/avm/ui/ficha";
import {
  chipFuenteCapa,
  ETIQUETA_ESTADO_FUENTE,
  ETIQUETA_RANGE_METHOD,
  etiquetaMetodoAlquiler,
  ETIQUETA_AJUSTE,
  etiquetaPenalizacion,
  humanizarExplicacion,
  tituloMercadoZona,
} from "../../lib/avm/ui/labels";
import {
  fmtEuros,
  fmtEurosPorM2,
  fmtMesHistoricoDisponible,
  fmtNumero,
  fmtPorcentaje,
  fmtRangoEuros,
  fmtRangoNumeros,
} from "../../lib/avm/ui/format";
import type { FieldSource } from "../../lib/avm/twin-builder";
import type { EntornoCoverage } from "../../lib/avm/entorno-coverage";
import { MapaValoracion } from "./MapaValoracion";
import { EntornoInforme, FlagsEntorno } from "./EntornoInforme";
import { InformeAcciones } from "./InformeAcciones";

export type InformeProps = {
  creada: string;
  result: ValuationResult;
  twin: Twin;
  fieldSources?: Partial<Record<string, FieldSource | string>>;
  valuationId?: string;
  mesesHistoricoZona?: number;
  primerMesZona?: string | null;
  entornoCoverage?: EntornoCoverage | null;
};

const colorEstado: Record<SourceUsed["status"], string> = {
  primary: "bg-emerald-500",
  fallback: "bg-amber-500",
  degraded: "bg-amber-500",
  missing: "bg-red-500/80",
};

export function InformeValoracion({
  creada,
  result,
  twin,
  fieldSources = {},
  valuationId,
  mesesHistoricoZona = 0,
  primerMesZona = null,
  entornoCoverage = null,
}: InformeProps) {
  const municipioEntorno =
    twin.address.locality ??
    twin.address.formattedAddress?.match(/\(([^)]+)\)/)?.[1] ??
    "este municipio";
  const ctx = {
    zoneKey: result.zoneStats?.zoneKey,
    comparablesCount: result.comparables.length,
    comparablesRadiusM: result.comparables.reduce((a, c) => Math.max(a, c.radiusM), 0) || 300,
  };
  const { penalties } = computeConfidence({
    sourcesUsed: result.sourcesUsed,
    comparables: result.comparables,
    precisionScore: result.precisionScore,
    trend12mPct: result.zoneStats?.trend12mPct ?? null,
  });
  const filas = filasFicha(twin, fieldSources);
  const zona = result.zoneStats;
  const compsOrden = [...result.comparables].sort((a, b) => b.weight - a.weight);
  const penalizacionesVisibles = penalties.filter((p) => p.points > 0);
  const rangoPie =
    result.rangeMethod != null
      ? `${ETIQUETA_RANGE_METHOD[result.rangeMethod]} · ${fmtRangoEuros(result.valueLow, result.valueHigh)}`
      : fmtRangoEuros(result.valueLow, result.valueHigh);

  return (
    <article className="flex flex-col gap-4" data-testid="informe">
      <InformeAcciones className="min-[820px]:hidden" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="tiles">
        <Tile label="Valor de cierre" value={fmtEuros(result.valueMid)} foot={`rango ${rangoPie}`} grande />
        <Tile
          label="€/m² ajustado"
          value={result.pricePerM2 != null ? fmtEurosPorM2(result.pricePerM2) : "—"}
          foot={zona ? `zona ${fmtEurosPorM2(zona.medianPpm2)}` : "sin mediana de zona"}
        />
        <Tile label="Confianza" value={`${result.confidence} %`} foot={`precisión del formulario ${result.precisionScore} %`} />
        <Tile
          label="Alquiler"
          value={result.rentMonthly != null ? `${fmtNumero(result.rentMonthly)} €/mes` : "—"}
          foot={
            [
              etiquetaMetodoAlquiler(result.methodVersion, result.rentSource),
              result.grossYield != null ? `rentabilidad ${fmtPorcentaje(result.grossYield)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "sin alquiler"
          }
        />
      </section>

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Fuentes usadas</p>
            <div className="flex flex-wrap gap-2" data-testid="fuentes">
              {result.sourcesUsed.map((s) => (
                <span
                  key={`${s.layer}-${s.source}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-[12px] text-[var(--text-2)]"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorEstado[s.status]}`} aria-hidden />
                  {chipFuenteCapa(s, ctx)} · {ETIQUETA_ESTADO_FUENTE[s.status]}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">Por qué esta confianza</p>
            <ul className="space-y-1 text-[12px] text-[var(--text-2)]">
              {penalizacionesVisibles.length ? (
                penalizacionesVisibles.map((p) => (
                  <li key={p.reason} className="flex gap-2">
                    <span className="shrink-0 font-medium tabular-nums text-red-500">−{p.points}</span>
                    <span>{etiquetaPenalizacion(p.reason, ctx)}</span>
                  </li>
                ))
              ) : (
                <li className="text-emerald-600 dark:text-emerald-400">0 · todas las fuentes principales</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-base font-semibold">Ficha del inmueble</h2>
          <div>
            <dl className="grid gap-x-4 gap-y-2 text-[13px]" data-testid="ficha">
              {filas.map((f) => (
                <div key={f.label} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-[var(--border-soft)] py-1.5 last:border-0">
                  <dt className="text-[var(--text-3)]">{f.label}</dt>
                  <dd className={`text-right ${f.vacio ? "text-[var(--text-3)]" : ""}`}>
                    {f.value}
                    {f.catastro && !f.vacio ? (
                      <span className="ml-1.5 inline-block rounded-full border border-[var(--border)] px-1.5 py-0 text-[10px] text-[var(--text-3)]">
                        Catastro
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
            {valuationId ? (
              <a
                href={`/valoraciones/nueva?from=${valuationId}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-2 text-[13px] font-medium sm:w-auto"
              >
                Completar datos y revalorar
              </a>
            ) : null}
          </div>
        </section>

        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-base font-semibold">{zona ? tituloMercadoZona(zona) : "Mercado de la zona"}</h2>
          <div>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <MiniTile
                label="Oferta · mediana"
                value={zona ? fmtEurosPorM2(zona.medianPpm2) : "—"}
                foot={
                  zona
                    ? `${fmtNumero(zona.n)} anuncios${
                        zona.p25Ppm2 != null && zona.p75Ppm2 != null
                          ? ` · P25–P75 ${fmtRangoNumeros(zona.p25Ppm2, zona.p75Ppm2)}`
                          : ""
                      }`
                    : "sin datos de zona"
                }
              />
              <MiniTile label="Cierre" value="pendiente" foot="se activa con los primeros cierres propios" />
            </div>
            {mesesHistoricoZona >= 6 ? (
              <div className="h-40 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]" data-testid="grafico-cierre" />
            ) : (
              <p className="text-[12px] text-[var(--text-3)]">
                {primerMesZona
                  ? `Histórico disponible a partir de ${fmtMesHistoricoDisponible(primerMesZona)}`
                  : "Histórico disponible cuando haya al menos seis meses de datos en la zona"}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-row flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Comparables · {result.comparables.length}</h2>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-[11px] text-[var(--text-2)]">
            ajustes solo por atributos del inmueble
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-x-auto" data-testid="comparables">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-[var(--text-3)]">
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 font-medium">Portal</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 font-medium">Anuncio</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 text-right font-medium">Precio</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 text-right font-medium">m²</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 text-right font-medium">€/m²</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 font-medium">Ajustes</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 text-right font-medium">€/m² aj.</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 pr-3 text-right font-medium">Distancia</th>
                  <th className="sticky top-0 bg-[var(--surface)] py-2 font-medium text-right">Peso</th>
                </tr>
              </thead>
              <tbody>
                {compsOrden.map((c) => (
                  <tr key={c.listingId} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-3">{portalLabel(c.portal)}</td>
                    <td className="max-w-[180px] py-2 pr-3">{c.title || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtEuros(c.price)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNumero(c.surface)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNumero(c.pricePerM2)}</td>
                    <td className="py-2 pr-3">
                      <Ajustes c={c} />
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums">{fmtNumero(c.adjustedPpm2)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmtNumero(c.distanceM)} m</td>
                    <td className="py-2 text-right tabular-nums">{c.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="min-w-0">
            {twin.address.lat != null && twin.address.lng != null ? (
              <>
                <MapaValoracion lat={twin.address.lat} lng={twin.address.lng} comparables={compsOrden} />
                <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-[var(--text-3)]">
                  <span>
                    <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--foreground)] align-middle" />
                    Inmueble
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#7ab8ff] align-middle" />
                    Comparable (tamaño = peso)
                  </span>
                  <span>anillos a 100, 200 y 300 m</span>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[var(--text-3)]">Sin coordenadas para el mapa.</p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <EntornoInforme
          environment={result.environment}
          coverage={entornoCoverage}
          municipalityLabel={municipioEntorno}
        />
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-base font-semibold">Riesgos y avisos</h2>
          <div className="space-y-4">
            <FlagsEntorno flags={result.environment?.flags ?? []} />
            <div className="h-px bg-[var(--border)]" />
            <div>
              <h3 className="mb-2 text-base font-semibold">Alquiler y rentabilidad</h3>
              <dl className="grid gap-x-4 gap-y-2 text-[13px]">
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <dt className="text-[var(--text-3)]">Rentabilidad bruta</dt>
                  <dd className="tabular-nums">{result.grossYield != null ? fmtPorcentaje(result.grossYield) : "—"}</dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <dt className="text-[var(--text-3)]">Alquiler mensual</dt>
                  <dd className="tabular-nums">{result.rentMonthly != null ? `${fmtNumero(result.rentMonthly)} €/mes` : "—"}</dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <dt className="text-[var(--text-3)]">Renta anual</dt>
                  <dd className="tabular-nums">
                    {result.rentMonthly != null ? `${fmtNumero(result.rentMonthly * 12)} €` : "—"}
                  </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <dt className="text-[var(--text-3)]">Método</dt>
                  <dd>{etiquetaMetodoAlquiler(result.methodVersion, result.rentSource)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 text-base font-semibold">Cómo se ha calculado</h2>
        <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[var(--text-3)]">
          {result.explanation.map((linea) => humanizarExplicacion(linea, ctx)).join("\n")}
        </pre>
      </section>
    </article>
  );
}

const PORTAL_NOMBRE: Record<string, string> = {
  fotocasa: "Fotocasa",
  idealista: "Idealista",
  habitaclia: "Habitaclia",
  pisos: "pisos.com",
  milanuncios: "Milanuncios",
};

function portalLabel(portal: string): string {
  return PORTAL_NOMBRE[portal] ?? portal;
}

function Tile({ label, value, foot, grande }: { label: string; value: string; foot: string; grande?: boolean }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4">
      <div className="text-[12px] text-[var(--text-3)]">{label}</div>
      <div className={`mt-1.5 font-semibold tabular-nums tracking-[-0.02em] ${grande ? "text-[30px]" : "text-2xl"}`}>{value}</div>
      <div className="mt-1.5 text-[12px] text-[var(--text-3)]">{foot}</div>
    </div>
  );
}

function MiniTile({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <div className="text-[12px] text-[var(--text-3)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--text-3)]">{foot}</div>
    </div>
  );
}

function Ajustes({ c }: { c: import("../../lib/avm/types").AdjustedComparable }) {
  const chips = Object.entries(c.adjustments).filter(([, f]) => Math.abs(f - 1) > 0.004);
  if (!chips.length) return <span className="text-[var(--text-3)]">sin ajustes</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map(([k, f]) => {
        const pct = Math.round((f - 1) * 100);
        const up = pct > 0;
        return (
          <span
            key={k}
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
          >
            {up ? "+" : "−"}
            {Math.abs(pct)} % {ETIQUETA_AJUSTE[k] ?? k}
          </span>
        );
      })}
    </span>
  );
}

