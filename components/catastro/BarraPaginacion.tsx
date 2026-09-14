"use client";

import {
  textoListadoParcial,
  UNIDAD_FINCAS,
  type UnidadListado,
} from "@/lib/catastro/explorer/history-ui";
import { cn } from "@/lib/utils";

const BOTON =
  "inline-flex h-9 shrink-0 items-center rounded-lg border border-[#DAD6CE] bg-white px-3 text-[13px] font-semibold text-[#131C1A] disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  viendo: number;
  total: number;
  unidad?: UnidadListado;
  hayMas: boolean;
  cargando?: boolean;
  onMas: () => void;
};

export function BarraPaginacion({
  viendo,
  total,
  unidad = UNIDAD_FINCAS,
  hayMas,
  cargando = false,
  onMas,
}: Props) {
  if (total <= 0 && !cargando) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p
        className={cn("min-w-0 flex-1 text-[13px] tabular-nums text-[#5D6B67]", cargando && "text-[#8A9692]")}
        aria-live="polite"
      >
        {textoListadoParcial(viendo, total, unidad)}
        {cargando ? " · cargando…" : null}
      </p>
      {hayMas ? (
        <button type="button" className={BOTON} disabled={cargando} onClick={onMas}>
          Mostrar más
        </button>
      ) : null}
    </div>
  );
}
