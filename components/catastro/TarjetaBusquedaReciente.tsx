"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CLASES_TARJETA_BUSQUEDA,
  ESTADO_BUSQUEDA_UI,
  ERROR_ELIMINAR,
  TEXTO_ELIMINAR_BUSQUEDA,
  eliminarBusquedaUi,
  etiquetaTipoBusqueda,
  fechaBusquedaCorta,
  formatoNumeroEs,
  rutaBusquedaHistorica,
  textosCoberturaHistorica,
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
  const cobertura = textosCoberturaHistorica(item.coverage);
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {etiquetaTipoBusqueda(item.mode)}
        </p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{item.titulo}</h3>
        <p className="mt-2 text-sm text-neutral-700">
          {formatoNumeroEs(item.fincas)} {item.fincas === 1 ? "finca" : "fincas"}
        </p>
        <p className="text-sm text-neutral-700">
          {formatoNumeroEs(item.candidatas)} {item.candidatas === 1 ? "candidata" : "candidatas"}
        </p>
        <p className="mt-1 font-mono text-xs tracking-wide text-neutral-600">
          {ESTADO_BUSQUEDA_UI[item.status]}
        </p>
        <p className="mt-1 text-sm text-neutral-500">{fechaBusquedaCorta(item.updatedAt)}</p>
        <p className="mt-2 text-xs font-medium text-neutral-600">{cobertura.estado}</p>
        {cobertura.corte ? <p className="mt-1 text-xs text-amber-800">{cobertura.corte}</p> : null}
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <Button asChild size="sm">
          <Link href={rutaBusquedaHistorica(item.id)}>Abrir</Link>
        </Button>
        <div ref={menuRef} className="relative">
          <Button
            type="button"
            size="sm"
            variant="secondary"
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
