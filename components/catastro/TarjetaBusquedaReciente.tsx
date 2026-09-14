"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CLASE_CHIP_ESTADO,
  CLASES_CHIP_ESTADO,
  CLASES_PUNTO_ESTADO,
  CLASES_TARJETA_BUSQUEDA,
  ESTADO_BUSQUEDA_UI,
  ERROR_ELIMINAR,
  TEXTO_ELIMINAR_BUSQUEDA,
  TEXTO_REANUDAR_BUSQUEDA,
  eliminarBusquedaUi,
  lineaMetaListaBusqueda,
  puedeReanudarHistorica,
  progresoListaBusqueda,
  rutaBusquedaHistorica,
  urlReanudarBusqueda,
  type ResumenBusquedaUi,
} from "@/lib/catastro/explorer/history-ui";
import { ConfirmacionEliminarBusqueda } from "./ConfirmacionEliminarBusqueda";

export function TarjetaBusquedaReciente({
  item,
  onEliminada,
}: {
  item: ResumenBusquedaUi;
  onEliminada?: (id: string) => void;
}) {
  const reanudable = puedeReanudarHistorica({
    mode: item.mode,
    status: item.status,
    coverage: item.coverage,
  });
  const progreso = progresoListaBusqueda({
    mode: item.mode,
    status: item.status,
    coverage: item.coverage,
  });
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchoBarra = `${Math.round(Math.min(1, Math.max(0, progreso.ratio)) * 100)}%`;

  useEffect(() => {
    if (!menu) return;
    const onClick = (evento: MouseEvent) => {
      if (!menuRef.current?.contains(evento.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menu]);

  const eliminar = async () => {
    setBorrando(true);
    try {
      await eliminarBusquedaUi(item.id);
      setConfirmar(false);
      onEliminada?.(item.id);
    } catch {
      toast.error(ERROR_ELIMINAR);
    } finally {
      setBorrando(false);
    }
  };

  return (
    <article className={CLASES_TARJETA_BUSQUEDA}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", CLASES_PUNTO_ESTADO[item.status])}
          aria-hidden
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{item.titulo}</h3>
            <p className={cn(CLASE_CHIP_ESTADO, CLASES_CHIP_ESTADO[item.status])}>
              {ESTADO_BUSQUEDA_UI[item.status]}
            </p>
          </div>
          <p className="mt-0.5 text-[13px] text-neutral-500">{lineaMetaListaBusqueda(item)}</p>
          <div className="mt-2 min-[780px]:hidden">
            <BarraProgreso etiqueta={progreso.etiqueta} ancho={anchoBarra} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-[18px] min-[780px]:pl-0">
        <div className="hidden w-[7.25rem] min-[780px]:block">
          <BarraProgreso etiqueta={progreso.etiqueta} ancho={anchoBarra} />
        </div>
        <Button asChild size="sm" variant="secondary" className="min-h-9 px-3.5">
          <Link href={rutaBusquedaHistorica(item.id)}>Abrir</Link>
        </Button>
        <div ref={menuRef} className="relative">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 px-0"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Más acciones"
            onClick={() => setMenu((prev) => !prev)}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
          {menu ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-border bg-white p-1 shadow-lg"
            >
              {reanudable ? (
                <Link
                  role="menuitem"
                  href={urlReanudarBusqueda(item.id)}
                  className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-neutral-50"
                  onClick={() => setMenu(false)}
                >
                  {TEXTO_REANUDAR_BUSQUEDA}
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                onClick={() => {
                  setMenu(false);
                  setConfirmar(true);
                }}
              >
                {TEXTO_ELIMINAR_BUSQUEDA}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <ConfirmacionEliminarBusqueda
        abierta={confirmar}
        cargando={borrando}
        onCancelar={() => {
          if (!borrando) setConfirmar(false);
        }}
        onConfirmar={() => void eliminar()}
      />
    </article>
  );
}

function BarraProgreso({ etiqueta, ancho }: { etiqueta: string; ancho: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6E3DD]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number.parseInt(ancho, 10)}
        aria-label={etiqueta}
      >
        <div className="h-full rounded-full bg-[#0B7461]" style={{ width: ancho }} />
      </div>
      {etiqueta ? <p className="text-[11px] leading-none text-neutral-500">{etiqueta}</p> : null}
    </div>
  );
}
