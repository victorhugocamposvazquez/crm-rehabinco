import React from "react";
import type { OfficialReference } from "../../lib/avm/types";
import { etiquetaTrimestre } from "../../lib/avm/oficial/referencia";
import { fmtEurosPorM2, fmtNumero } from "../../lib/avm/ui/format";

const color: Record<OfficialReference["puntos"][number]["sense"], string> = {
  positive: "bg-emerald-500",
  negative: "bg-red-500",
  info: "bg-[var(--text-3)]",
};

const LECTURA: Record<NonNullable<OfficialReference["lectura"]>, string> = {
  en_linea: "en línea",
  por_encima: "por encima",
  por_debajo: "por debajo",
};

/** Valor tasado (MIVAU), compraventas e IPV (INE) frente a la estimación. */
export function ReferenciaOficial({ referencia }: { referencia: OfficialReference | null | undefined }) {
  if (!referencia) return null;
  const { tasado, transacciones, ipv, desviacionPct, lectura } = referencia;
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5" data-testid="referencia-oficial">
      <h2 className="mb-3 text-base font-semibold">Referencia oficial</h2>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Dato
          label="Valor tasado medio"
          value={tasado ? fmtEurosPorM2(tasado.ppm2) : "—"}
          foot={tasado ? `${tasado.label} · ${etiquetaTrimestre(tasado.period)}${tasado.tasaciones ? ` · ${fmtNumero(tasado.tasaciones)} tasaciones` : ""}` : "sin dato"}
        />
        <Dato
          label="Estimación frente al tasado"
          value={desviacionPct != null ? `${desviacionPct > 0 ? "+" : ""}${desviacionPct.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : "—"}
          foot={lectura ? LECTURA[lectura] : "el mercado de respaldo ya es el tasado"}
        />
        <Dato
          label="Compraventas último año"
          value={transacciones ? fmtNumero(transacciones.ultimos12m) : "—"}
          foot={
            transacciones?.variacionPct != null
              ? `${transacciones.variacionPct > 0 ? "+" : ""}${transacciones.variacionPct.toLocaleString("es-ES", { maximumFractionDigits: 1 })} % interanual`
              : ipv
                ? `IPV ${ipv.ambito}: ${ipv.anualPct > 0 ? "+" : ""}${ipv.anualPct.toLocaleString("es-ES")} %`
                : "sin dato"
          }
        />
      </div>
      <ul className="flex flex-col gap-2 text-[13px] leading-snug" data-testid="referencia-puntos">
        {referencia.puntos.map((p) => (
          <li key={p.indicator} className="flex gap-2">
            <i className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color[p.sense]}`} />
            <span>{p.text}</span>
          </li>
        ))}
      </ul>
      {referencia.fuentes.length ? (
        <p className="mt-3 text-[11px] text-[var(--text-3)]">Fuentes: {referencia.fuentes.join(" · ")}. Informativo: no cambia el precio.</p>
      ) : null}
    </section>
  );
}

function Dato({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-3">
      <div className="text-[12px] text-[var(--text-3)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--text-3)]">{foot}</div>
    </div>
  );
}
