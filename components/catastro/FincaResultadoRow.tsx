"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  clasePuntoDivision,
  claseTextoDivision,
  etiquetaEstadoDivisionLista,
  metricasFincaLista,
  tituloDireccionFinca,
  type FincaBusquedaUi,
} from "@/lib/catastro/search-ui";
import { copiarAlPortapapeles } from "@/lib/catastro/selection-export";
import { cn } from "@/lib/utils";

type Props = {
  finca: FincaBusquedaUi;
  selected?: boolean;
  checked?: boolean;
  vinculada?: boolean;
  onSelect?: () => void;
  onToggle?: () => void;
  onProperty?: () => void;
};

export function FincaResultadoRow({
  finca,
  selected = false,
  checked = false,
  vinculada = false,
  onSelect,
  onToggle,
  onProperty,
}: Props) {
  const metricas = metricasFincaLista(finca);
  const status = finca.horizontalDivision?.status;

  const copiar = async (evento: React.MouseEvent) => {
    evento.stopPropagation();
    const ok = await copiarAlPortapapeles(finca.fincaReference);
    if (ok) toast.success("Referencia copiada");
    else toast.error("No se ha podido copiar.");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-wrap items-center gap-3.5 border-b border-[#F2F0EB] px-3.5 py-2.5 text-[#131C1A] hover:bg-[#FBFBF9]",
        selected && "bg-[#F4F8F6] shadow-[inset_3px_0_0_#0B7461]"
      )}
    >
      <div className="flex min-w-0 flex-[1_1_250px] items-start gap-2.5">
        {onToggle ? (
          <input
            type="checkbox"
            checked={checked}
            aria-label={`Seleccionar ${tituloDireccionFinca(finca)}`}
            className="mt-1 h-[17px] w-[17px] cursor-pointer rounded-[5px] border-[#CFCBC2] accent-[#0B7461]"
            onClick={(evento) => evento.stopPropagation()}
            onChange={() => onToggle()}
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold tracking-tight">{tituloDireccionFinca(finca)}</p>
          <p className="mt-1 font-mono text-[11.5px] text-[#5D6B67]">{finca.fincaReference}</p>
        </div>
      </div>

      <div className="flex flex-none flex-wrap gap-1">
        <Dato label="Parcela" value={metricas.parcela} ancho="w-[74px]" />
        <Dato label="Inmuebles" value={metricas.inmuebles} ancho="w-[74px]" />
        <Dato label="Año" value={metricas.anio} ancho="w-[62px]" />
        <Dato label="Uso" value={metricas.uso} ancho="w-[86px]" />
      </div>

      <div className="flex w-[132px] flex-none items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 flex-none rounded-full", clasePuntoDivision(status))} aria-hidden />
        <span className={cn("whitespace-nowrap text-[12.5px] font-medium", claseTextoDivision(status))}>
          {etiquetaEstadoDivisionLista(status)}
        </span>
      </div>

      <div className="flex flex-none gap-1">
        {onProperty ? (
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              onProperty();
            }}
            className={cn(
              "h-[29px] rounded-lg border border-[#DAD6CE] bg-white px-2.5 text-xs font-semibold",
              vinculada ? "text-[#2B4A8A]" : "text-[#0B7461]"
            )}
          >
            {vinculada ? "Ver propiedad" : "Propiedad"}
          </button>
        ) : null}
        <button
          type="button"
          title="Copiar referencia"
          onClick={(evento) => void copiar(evento)}
          className="flex h-[29px] w-[29px] items-center justify-center rounded-lg border border-[#E6E3DD] bg-white text-[#5D6B67]"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Dato({ label, value, ancho }: { label: string; value: string; ancho: string }) {
  return (
    <div className={ancho}>
      <p className="text-[11px] uppercase tracking-wider text-[#6B7A76]">{label}</p>
      <p className="mt-0.5 text-[13.5px] tabular-nums">{value}</p>
    </div>
  );
}
