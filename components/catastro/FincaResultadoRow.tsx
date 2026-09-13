"use client";

import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  clasePuntoDivision,
  claseTextoDivision,
  etiquetaEstadoDivisionLista,
  metricasFincaLista,
  resumenTarjetaMovil,
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
  asignado?: string | null;
};

export function FincaResultadoRow({
  finca,
  selected = false,
  checked = false,
  vinculada = false,
  onSelect,
  onToggle,
  onProperty,
  asignado = null,
}: Props) {
  const metricas = metricasFincaLista(finca);
  const status = finca.horizontalDivision?.status;
  const titulo = tituloDireccionFinca(finca);

  const copiar = async (evento: React.MouseEvent) => {
    evento.stopPropagation();
    const ok = await copiarAlPortapapeles(finca.fincaReference);
    if (ok) toast.success("Referencia copiada");
    else toast.error("No se ha podido copiar.");
  };

  const irPropiedad = (evento: React.MouseEvent) => {
    evento.stopPropagation();
    onProperty?.();
  };

  const irOportunidad = (evento: React.MouseEvent) => {
    evento.stopPropagation();
    if (vinculada && onProperty) {
      onProperty();
      return;
    }
    toast.message("La visita se crea desde la propiedad, no desde Catastro.");
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
        "bg-white text-[#131C1A]",
        "max-[779px]:overflow-hidden max-[779px]:rounded-[13px] max-[779px]:border max-[779px]:border-[#E6E3DD]",
        "min-[780px]:flex min-[780px]:cursor-pointer min-[780px]:flex-nowrap min-[780px]:items-center min-[780px]:gap-3.5 min-[780px]:border-b min-[780px]:border-[#F2F0EB] min-[780px]:px-3.5 min-[780px]:py-2.5 min-[780px]:hover:bg-[#FBFBF9]",
        selected && "min-[780px]:bg-[#F4F8F6] min-[780px]:shadow-[inset_3px_0_0_#0B7461]"
      )}
    >
      <div className="min-w-0 flex-[1_1_250px] px-3.5 pb-[11px] pt-[13px] min-[780px]:p-0">
        <div className="flex items-start gap-2.5">
          {onToggle ? (
            <label
              className="mt-0.5 hidden h-[17px] w-[17px] shrink-0 min-[780px]:block"
              onClick={(evento) => evento.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-label={`Seleccionar ${titulo}`}
                className="h-[17px] w-[17px] cursor-pointer rounded-[5px] border-[#CFCBC2] accent-[#0B7461]"
                onChange={() => onToggle()}
              />
            </label>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-pretty min-[780px]:truncate min-[780px]:text-[14.5px]">
              {titulo}
            </p>
            <p className="mt-1 font-mono text-[11.5px] text-[#5D6B67]">{finca.fincaReference}</p>
            {asignado ? (
              <p className="mt-1 truncate text-[12px] font-medium text-[#0B7461]">{asignado}</p>
            ) : null}
          </div>
          <span className={cn("mt-0.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium min-[780px]:hidden", claseTextoDivision(status))}>
            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", clasePuntoDivision(status))} aria-hidden />
            {etiquetaEstadoDivisionLista(status)}
          </span>
        </div>
        <p className="mt-2.5 text-[12.5px] text-[#5D6B67] min-[780px]:hidden">{resumenTarjetaMovil(finca)}</p>
      </div>

      <div className="hidden flex-none items-start gap-1 min-[780px]:flex">
        <Dato label="Parcela" value={metricas.parcela} ancho="w-[74px]" />
        <Dato label="Inmuebles" value={metricas.inmuebles} ancho="w-[74px]" />
        <Dato label="Año" value={metricas.anio} ancho="w-[52px]" />
        <Dato label="Uso" value={metricas.uso} ancho="w-[118px]" />
      </div>

      <div className="hidden w-[132px] flex-none items-center gap-1.5 min-[780px]:flex">
        <span className={cn("h-1.5 w-1.5 flex-none rounded-full", clasePuntoDivision(status))} />
        <span className={cn("whitespace-nowrap text-[12.5px] font-medium", claseTextoDivision(status))}>
          {etiquetaEstadoDivisionLista(status)}
        </span>
      </div>

      <div className="hidden flex-none gap-1 min-[780px]:flex">
        {onProperty ? (
          <button
            type="button"
            onClick={irPropiedad}
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

      <div className="flex gap-px border-t border-[#EFEDE7] bg-[#EFEDE7] min-[780px]:hidden">
        {onProperty ? (
          <button
            type="button"
            onClick={irPropiedad}
            className={cn(
              "flex min-h-[46px] flex-[1.3] items-center justify-center gap-1.5 bg-white text-[12.5px] font-semibold",
              vinculada ? "text-[#2B4A8A]" : "text-[#0B7461]"
            )}
          >
            {vinculada ? null : <Plus className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden />}
            {vinculada ? "Ver propiedad" : "Crear propiedad"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={irOportunidad}
          className="flex min-h-[46px] flex-1 items-center justify-center bg-white text-[12.5px] font-semibold text-[#5D6B67]"
        >
          Oportunidad
        </button>
        <button
          type="button"
          onClick={(evento) => {
            evento.stopPropagation();
            onSelect?.();
          }}
          className="min-h-[46px] w-[62px] shrink-0 bg-white text-[12.5px] font-semibold text-[#5D6B67]"
        >
          Ficha
        </button>
      </div>
    </div>
  );
}

function Dato({ label, value, ancho }: { label: string; value: string; ancho: string }) {
  return (
    <div className={cn(ancho, "min-w-0")}>
      <p className="text-[11px] uppercase tracking-wider text-[#6B7A76]">{label}</p>
      <p className="mt-0.5 truncate text-[13.5px] tabular-nums" title={value}>
        {value}
      </p>
    </div>
  );
}
