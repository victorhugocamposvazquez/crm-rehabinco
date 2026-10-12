"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TagAvm } from "@/components/avm/nueva/wizard-ui";
import { fmtEurosPorM2, fmtNumero } from "@/lib/avm/ui/format";
import type { FilaConocido } from "@/lib/avm/wizard-known";
import type { Twin } from "@/lib/avm/types";

type Props = {
  precision: number;
  estimado: { low: number; high: number; mid: number; uncertainty: number } | null;
  twin: Twin | null;
  confirmados: number;
  conocidos?: FilaConocido[];
  onIrCampo?: (key: string) => void;
  mediana: { median: number; n: number; trend: number | null; label?: string } | null;
  listoValorar: boolean;
  ocupado: boolean;
  onValorar: () => void;
  compacto?: boolean;
};

export function PanelLateralValoracion({
  precision,
  estimado,
  twin,
  confirmados,
  conocidos = [],
  onIrCampo,
  mediana,
  listoValorar,
  ocupado,
  onValorar,
  compacto,
}: Props) {
  const [resumenAbierto, setResumenAbierto] = useState(false);
  const desenfocado = !twin?.mainType || !twin.builtSurface;
  const cuerpo = (
    <>
      {conocidos.length ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Lo que ya sabemos · {confirmados}
          </p>
          <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
            {conocidos.map((r) => (
              <button
                key={r.key}
                type="button"
                className="flex w-full items-start justify-between gap-2 rounded-md px-1 py-1.5 text-left text-[13px] hover:bg-[var(--surface-soft)]"
                onClick={() => onIrCampo?.(r.key)}
              >
                <span className="text-[var(--text-3)]">{r.label}</span>
                <span className={`min-w-0 text-right ${r.unknown ? "text-[var(--text-3)] italic" : "font-medium"}`}>
                  {r.value}
                  {r.source ? (
                    <TagAvm className="ml-1 inline border-transparent bg-blue-500/10 text-blue-600">{r.source}</TagAvm>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between text-[12px] text-[var(--text-3)]">
          <span>Precisión de la valoración</span>
          <b className="text-[15px] tabular-nums text-foreground">{precision} %</b>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-[var(--surface-soft)]">
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${precision}%` }} />
        </div>
        <div className="my-3 h-px bg-[var(--border)]" />
        <p className="text-[12px] text-[var(--text-3)]">Rango de estimación en vivo</p>
        <p
          className={`mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em] transition-[filter] ${desenfocado ? "blur-[7px] select-none" : ""}`}
        >
          {estimado && !desenfocado
            ? `${fmtNumero(estimado.low)} – ${fmtNumero(estimado.high)} €`
            : "— €"}
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-3)]">
          {!twin?.address.lat
            ? "Empieza por la dirección, la referencia catastral o el mapa."
            : desenfocado
              ? "Se desenfoca al saber el tipo y la superficie."
              : estimado
                ? `±${estimado.uncertainty} % · ${mediana ? "con el €/m² real de tu zona" : "estimación base"}`
                : ""}
        </p>
        <div className="my-3 h-px bg-[var(--border)]" />
      </div>

      {twin?.address.lat != null ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Tu zona · {mediana?.label ?? twin.address.postcode ?? twin.address.locality ?? "zona"}
          </p>
          {mediana?.median ? (
            <dl className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-3)]">Precio mediano de oferta</dt>
                <dd className="tabular-nums">{fmtEurosPorM2(mediana.median)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-3)]">Anuncios en la zona</dt>
                <dd className="tabular-nums">{mediana.n}</dd>
              </div>
              {mediana.trend != null ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--text-3)]">Tendencia 12 meses</dt>
                  <dd className="tabular-nums">{mediana.trend > 0 ? "+" : ""}{mediana.trend} %</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-[13px] text-[var(--text-3)]">Aún sin mediana en esta zona.</p>
          )}
        </div>
      ) : null}

      {listoValorar ? (
        <Button type="button" className="w-full" disabled={ocupado} onClick={onValorar}>
          {ocupado ? "Valorando…" : "Valorar"}
        </Button>
      ) : null}
    </>
  );

  if (compacto) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2 text-[12px] text-[var(--text-3)]"
          onClick={() => setResumenAbierto((v) => !v)}
        >
          <span>Lo que ya sabemos ({confirmados})</span>
          <span>{resumenAbierto ? "▾" : "▸"}</span>
        </button>
        {resumenAbierto && conocidos.length ? (
          <div className="max-h-40 overflow-y-auto border-t border-[var(--border)] px-4 py-2">
            {conocidos.slice(0, 12).map((r) => (
              <button
                key={r.key}
                type="button"
                className="block w-full py-1 text-left text-[12px]"
                onClick={() => onIrCampo?.(r.key)}
              >
                <span className="text-[var(--text-3)]">{r.label}: </span>
                <span className={r.unknown ? "italic text-[var(--text-3)]" : ""}>{r.value}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--text-3)]">Precisión {precision} %</p>
            <p className={`truncate text-[15px] font-semibold tabular-nums ${desenfocado ? "blur-sm" : ""}`}>
              {estimado && !desenfocado
                ? `${fmtNumero(estimado.low)} – ${fmtNumero(estimado.high)} €`
                : "— €"}
            </p>
          </div>
          {listoValorar ? (
            <Button type="button" size="sm" disabled={ocupado} onClick={onValorar}>
              Valorar
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return <aside className="sticky top-[4.5rem] hidden w-[340px] shrink-0 flex-col gap-3.5 lg:flex">{cuerpo}</aside>;
}
