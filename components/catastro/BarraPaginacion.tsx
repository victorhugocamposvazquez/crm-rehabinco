"use client";

import { cn } from "@/lib/utils";

const BOTON =
  "inline-flex h-9 shrink-0 items-center rounded-lg border border-[#DAD6CE] bg-white px-3 text-[13px] font-semibold text-[#131C1A] disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  etiqueta: string;
  pagina: number;
  paginas: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  cargando?: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  onIrA?: (pagina: number) => void;
};

export function BarraPaginacion({
  etiqueta,
  pagina,
  paginas,
  hayAnterior,
  haySiguiente,
  cargando = false,
  onAnterior,
  onSiguiente,
  onIrA,
}: Props) {
  if (paginas <= 1 && !cargando) return null;
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Paginación">
      <button type="button" className={BOTON} disabled={!hayAnterior || cargando} onClick={onAnterior}>
        Anterior
      </button>
      {onIrA && paginas > 1 ? (
        <label className="flex items-center gap-1.5 text-[12.5px] text-[#5D6B67]">
          <span className="sr-only">Ir a página</span>
          <select
            className="h-9 rounded-lg border border-[#DAD6CE] bg-white px-2 text-[13px] font-semibold tabular-nums text-[#131C1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B7461]"
            value={pagina}
            disabled={cargando}
            aria-label="Ir a página"
            onChange={(evento) => onIrA(Number(evento.target.value))}
          >
            {Array.from({ length: paginas }, (_, indice) => indice + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span aria-hidden>de {paginas.toLocaleString("es-ES")}</span>
        </label>
      ) : null}
      <p
        className={cn("min-w-0 flex-1 text-[13px] font-medium tabular-nums text-[#131C1A]", cargando && "text-[#5D6B67]")}
        aria-live="polite"
      >
        {etiqueta}
        {cargando ? " · cargando…" : null}
      </p>
      <button type="button" className={BOTON} disabled={!haySiguiente || cargando} onClick={onSiguiente}>
        Siguiente
      </button>
    </nav>
  );
}
