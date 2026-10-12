"use client";

import { Button } from "@/components/ui/button";
import { fmtEurosPorM2, fmtNumero } from "@/lib/avm/ui/format";
import type { Twin } from "@/lib/avm/types";

type Props = {
  precision: number;
  estimado: { low: number; high: number; mid: number; uncertainty: number } | null;
  twin: Twin | null;
  confirmados: number;
  mediana: { median: number; n: number; trend: number | null; label?: string } | null;
  muestraCatastro: boolean;
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
  mediana,
  muestraCatastro,
  listoValorar,
  ocupado,
  onValorar,
  compacto,
}: Props) {
  const desenfocado = !twin?.mainType || !twin.builtSurface;
  const cuerpo = (
    <>
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
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[var(--text-3)]">Detalles confirmados</span>
          <b className="tabular-nums">{confirmados}</b>
        </div>
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

      {muestraCatastro ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Rellenado desde Catastro
          </p>
          <p className="text-[12px] text-[var(--text-3)]">
            Superficie, año, planta y tipo ya están. Solo confirmas y añades lo que Catastro no sabe.
          </p>
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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--text-3)]">Precisión {precision} %</p>
            <p className={`truncate text-[15px] font-semibold tabular-nums ${desenfocado ? "blur-sm" : ""}`}>
              {estimado && !desenfocado ? `${fmtNumero(estimado.mid)} €` : "— €"}
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
