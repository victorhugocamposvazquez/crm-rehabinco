"use client";

import { Ban, Check, ChevronRight } from "lucide-react";
import { direccionPrincipal, ETIQUETA_USO, type EdificioMapa } from "@/lib/catastro/mapa/inspire";
import { tieneDivisionHorizontal } from "@/lib/catastro/mapa/filtros";

function m2(v: number | null) {
  return v == null ? "—" : `${v.toLocaleString("es-ES")} m²`;
}

/** Tarjeta de edificio en la lista del mapa. */
export function TarjetaEdificio({
  edificio: e,
  trabajado,
  onAbrir,
}: {
  edificio: EdificioMapa;
  trabajado: boolean;
  onAbrir: () => void;
}) {
  const dh = tieneDivisionHorizontal(e);
  return (
    <button type="button" onClick={onAbrir} className="aire-tarjeta flex w-full flex-col text-left" data-testid="tarjeta-edificio">
      <div className="flex w-full items-start gap-2 px-3.5 pt-3">
        <span className="line-clamp-2 flex-1 text-base text-[var(--titulo,var(--foreground))]">{direccionPrincipal(e)}</span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
      </div>
      <div className="px-3.5 pb-2 text-[12px] tabular-nums text-[var(--text-2)]">{e.ref}</div>
      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3">
        {dh ? (
          <span className="flex items-center gap-2 rounded-[6px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-sm">
            División horizontal <span className="text-[12px] text-[var(--text-2)]">· {e.inmuebles} inmuebles</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-[6px] bg-[var(--amber-bg)] px-1.5 py-0.5 text-sm font-medium text-[var(--amber-ink)]">
            <Ban className="h-3.5 w-3.5" aria-hidden /> Sin división horizontal
          </span>
        )}
        {trabajado ? (
          <span className="flex items-center gap-1 rounded-[6px] bg-[var(--green-bg)] px-1.5 py-0.5 text-sm text-[var(--green)]">
            <Check className="h-3.5 w-3.5" aria-hidden /> Trabajado
          </span>
        ) : null}
      </div>
      <dl className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-[var(--border)] px-3.5 py-3 text-[12px] leading-4">
        <dt className="text-[var(--text-2)]">Uso principal</dt>
        <dd className="text-right">{ETIQUETA_USO[e.uso]}</dd>
        <dt className="text-[var(--text-2)]">Año de construcción</dt>
        <dd className="text-right tabular-nums">{e.anio ?? "—"}</dd>
        <dt className="text-[var(--text-2)]">Viviendas</dt>
        <dd className="text-right tabular-nums">{e.viviendas ?? "—"}</dd>
        <dt className="text-[var(--text-2)]">Sup. construida</dt>
        <dd className="text-right tabular-nums">{m2(e.superficie)}</dd>
      </dl>
    </button>
  );
}
