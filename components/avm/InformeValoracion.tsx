import React from "react";
import type { AdjustedComparable, Environment, SourceUsed, Twin, ValuationResult } from "../../lib/avm/types";
import { computeConfidence } from "../../lib/avm/confidence";
import { filasFicha } from "../../lib/avm/ui/ficha";
import type { FieldSource } from "../../lib/avm/twin-builder";

const euros = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

const ESTADO: Record<SourceUsed["status"], string> = {
  primary: "principal",
  fallback: "respaldo",
  degraded: "degradada",
  missing: "sin dato",
};

const ALQUILER: Record<NonNullable<ValuationResult["rentSource"]>, string> = {
  comparables: "comparables de alquiler",
  zone_adjusted: "zona ajustada",
  yield: "rentabilidad bruta",
};

export type InformeProps = {
  creada: string;
  result: ValuationResult;
  twin: Twin;
  fieldSources?: Partial<Record<string, FieldSource | string>>;
  comercial?: string | null;
  canal?: string | null;
};

export function InformeValoracion({ creada, result, twin, fieldSources = {}, comercial, canal }: InformeProps) {
  const { penalties } = computeConfidence({
    sourcesUsed: result.sourcesUsed,
    comparables: result.comparables,
    precisionScore: result.precisionScore,
    trend12mPct: result.zoneStats?.trend12mPct ?? null,
  });
  const filas = filasFicha(twin, fieldSources);
  const zona = result.zoneStats;
  const meses = 0;

  return (
    <article className="space-y-8">
      <header>
        <p className="text-[13px] text-[var(--text-3)]">
          {[twin.mainType, twin.builtSurface ? `${twin.builtSurface} m²` : null, twin.address.postcode, creada, result.methodVersion, comercial, canal].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-1 text-[28px] font-medium tracking-[-0.03em]">{twin.address.formattedAddress || "Valoración"}</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="tiles">
        <Tile
          label="Valor de cierre"
          value={euros(result.valueMid)}
          foot={`rango ${euros(result.valueLow)} – ${euros(result.valueHigh)}${result.rangeMethod ? ` · ${result.rangeMethod}` : ""}`}
        />
        <Tile
          label="€/m² ajustado"
          value={result.pricePerM2 != null ? `${num(result.pricePerM2)} €` : "—"}
          foot={zona ? `zona ${num(zona.medianPpm2)} €/m²` : "sin mediana de zona"}
        />
        <Tile label="Confianza" value={`${result.confidence} %`} foot={`precisión del formulario ${result.precisionScore} %`} />
        <Tile
          label="Alquiler"
          value={result.rentMonthly != null ? `${num(result.rentMonthly)} €/mes` : "—"}
          foot={[result.rentSource ? ALQUILER[result.rentSource] : null, result.grossYield != null ? `rentabilidad ${result.grossYield.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : null].filter(Boolean).join(" · ") || "sin alquiler"}
        />
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Fuentes usadas</h2>
        <div className="flex flex-wrap gap-1.5" data-testid="fuentes">
          {result.sourcesUsed.map((s) => (
            <span key={`${s.layer}-${s.source}`} className="rounded-md bg-[var(--surface-soft)] px-2 py-0.5 text-[12px]">
              {s.layer} · {s.source} · {ESTADO[s.status]}
            </span>
          ))}
        </div>
        <h3 className="mb-1 mt-4 text-[13px] font-medium">Por qué esta confianza</h3>
        <ul className="space-y-1 text-[13px] text-[var(--text-2)]">
          {(penalties.length ? penalties : [{ reason: "sin penalizaciones", points: 0 }]).map((p) => (
            <li key={p.reason}>−{p.points} {p.reason}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Ficha</h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2" data-testid="ficha">
          {filas.map((f) => (
            <div key={f.label}>
              <dt className="text-[12px] text-[var(--text-3)]">{f.label}</dt>
              <dd className="text-[14px]">
                {f.value} {f.catastro ? <span className="ml-1 rounded bg-[var(--surface-soft)] px-1.5 text-[11px]">Catastro</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Mercado de zona</h2>
        {zona ? (
          <p className="text-[14px]">
            {zona.label} · nivel {zona.zoneLevel} · mediana {num(zona.medianPpm2)} €/m²
            {zona.p25Ppm2 != null && zona.p75Ppm2 != null ? ` · P25–P75 ${num(zona.p25Ppm2)}–${num(zona.p75Ppm2)}` : ""} · {zona.n} anuncios
            {zona.trend12mPct != null ? ` · tendencia ${zona.trend12mPct} %` : ""}
          </p>
        ) : (
          <p className="text-[14px] text-[var(--text-3)]">Sin estadística de zona.</p>
        )}
        <p className="mt-1 text-[13px] text-[var(--text-3)]">Cierre: pendiente de cierres propios.</p>
        {meses >= 6 ? <div data-testid="grafico-cierre" /> : null}
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Comparables</h2>
        <div className="overflow-x-auto" data-testid="comparables">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[var(--text-3)]">
                <th className="py-1 pr-3 font-medium">Anuncio</th>
                <th className="py-1 pr-3 font-medium">Precio</th>
                <th className="py-1 pr-3 font-medium">m²</th>
                <th className="py-1 pr-3 font-medium">€/m²</th>
                <th className="py-1 pr-3 font-medium">Distancia</th>
                <th className="py-1 pr-3 font-medium">Ajustes</th>
                <th className="py-1 font-medium">Peso</th>
              </tr>
            </thead>
            <tbody>
              {result.comparables.map((c) => (
                <tr key={c.listingId} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">{c.title || c.portal}</td>
                  <td className="py-2 pr-3 tabular-nums">{euros(c.price)}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.surface}</td>
                  <td className="py-2 pr-3 tabular-nums">{num(c.pricePerM2)}</td>
                  <td className="py-2 pr-3 tabular-nums">{c.distanceM} m</td>
                  <td className="py-2 pr-3"><Ajustes c={c} /></td>
                  <td className="py-2 tabular-nums">{c.weight.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {result.environment ? <Entorno environment={result.environment} /> : null}

      <section>
        <h2 className="mb-2 text-[15px] font-medium">Cómo se ha calculado</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-[var(--text-2)]">
          {result.explanation.map((linea) => <li key={linea}>{linea}</li>)}
        </ol>
      </section>
    </article>
  );
}

function Tile({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="text-[12px] text-[var(--text-3)]">{label}</div>
      <div className="mt-1 text-[22px] font-medium tabular-nums tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--text-2)]">{foot}</div>
    </div>
  );
}

function Ajustes({ c }: { c: AdjustedComparable }) {
  const chips = Object.entries(c.adjustments).filter(([, f]) => Math.abs(f - 1) > 0.004);
  if (!chips.length) return <span className="text-[var(--text-3)]">sin ajustes</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map(([k, f]) => (
        <span key={k} className="rounded bg-[var(--surface-soft)] px-1.5 text-[11px]">
          {k} {f > 1 ? "+" : "−"}{Math.abs(Math.round((f - 1) * 100))} %
        </span>
      ))}
    </span>
  );
}

function Entorno({ environment }: { environment: Environment }) {
  return (
    <section data-testid="entorno">
      <h2 className="mb-2 text-[15px] font-medium">Entorno {environment.score != null ? `· ${environment.score}` : ""}</h2>
    </section>
  );
}
