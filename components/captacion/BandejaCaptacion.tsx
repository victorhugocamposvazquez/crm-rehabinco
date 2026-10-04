"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { tituloDireccionFinca } from "@/lib/catastro/search-ui";
import { rutaFincaPersistida } from "@/lib/catastro/explorer/history-ui";
import { rutaPropiedadCrm } from "@/lib/catastro/explorer";
import type { FincaCaptacionApi } from "@/lib/catastro-host/captacion-filas";
import {
  ESTADO_CAPTACION_LABEL,
  FILTROS_BANDEJA_CAPTACION,
  coincideFiltroBandeja,
  diasDesdeAsignacion,
  recuentoBandejaCaptacion,
  textoAging,
  type FiltroBandejaCaptacion,
} from "@/lib/captacion/estados";
import { cn } from "@/lib/utils";
import { CarrilHorizontal } from "@/components/ui/carril-horizontal";

export function BandejaCaptacion({
  items,
  mostrarComercial = false,
}: {
  items: FincaCaptacionApi[];
  mostrarComercial?: boolean;
}) {
  const [filtro, setFiltro] = useState<FiltroBandejaCaptacion>("TODAS");
  const hoy = new Date().toISOString().slice(0, 10);
  const recuento = recuentoBandejaCaptacion(items);
  const visibles = useMemo(
    () => items.filter((item) => coincideFiltroBandeja(item.estado, filtro, Boolean(item.propertyId))),
    [items, filtro]
  );

  return (
    <div>
      <CarrilHorizontal trackClassName="gap-1.5" label="Filtro de bandeja">
        {FILTROS_BANDEJA_CAPTACION.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFiltro(item.value)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-medium",
              filtro === item.value
                ? "border-foreground bg-accent-soft text-foreground"
                : "border-[var(--border)] bg-[var(--field)] text-[var(--text-2)]"
            )}
          >
            {item.label} ({recuento[item.value]})
          </button>
        ))}
      </CarrilHorizontal>
      <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {visibles.map((item) => {
          const dias = diasDesdeAsignacion(item.assignedAt, hoy);
          return (
            <li key={item.fincaReference}>
              <Link
                href={rutaFincaPersistida(item.fincaReference)}
                className="flex flex-col gap-1 px-4 py-3.5 hover:bg-[var(--surface-soft)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{tituloDireccionFinca(item.finca)}</p>
                  <p className="text-[12px] text-[var(--text-2)]">
                    {item.fincaReference}
                    {mostrarComercial ? ` · ${item.comercialNombre}` : ""}
                    {dias != null ? ` · ${textoAging(dias)}` : ""}
                  </p>
                  {item.proximaAccion ? (
                    <p className="mt-0.5 text-[12px] text-foreground">
                      {item.proximaAccion}
                      {item.proximaAccionEn ? ` · ${item.proximaAccionEn}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-foreground">
                    {ESTADO_CAPTACION_LABEL[item.estado]}
                  </span>
                  {item.propertyId ? (
                    <span className="rounded-full bg-[var(--green-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--green)]">
                      Propiedad
                    </span>
                  ) : null}
                </div>
              </Link>
              {item.propertyId ? (
                <div className="px-4 pb-3">
                  <Link href={rutaPropiedadCrm(item.propertyId)} className="text-[12px] font-medium text-foreground hover:underline">
                    Ver inmueble
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
        {visibles.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[var(--text-3)]">No hay fincas en este filtro.</li>
        ) : null}
      </ul>
    </div>
  );
}
