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
      <div className="flex flex-wrap gap-1.5">
        {FILTROS_BANDEJA_CAPTACION.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFiltro(item.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold",
              filtro === item.value
                ? "border-[#0B7461] bg-[#E8F3EF] text-[#08594B]"
                : "border-[#E6E3DD] bg-white text-[#5D6B67]"
            )}
          >
            {item.label} ({recuento[item.value]})
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-[#F2F0EB] overflow-hidden rounded-2xl border border-[#E6E3DD] bg-white">
        {visibles.map((item) => {
          const dias = diasDesdeAsignacion(item.assignedAt, hoy);
          return (
            <li key={item.fincaReference}>
              <Link
                href={rutaFincaPersistida(item.fincaReference)}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-[#FBFBF9] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#131C1A]">{tituloDireccionFinca(item.finca)}</p>
                  <p className="text-[12px] text-[#5D6B67]">
                    {item.fincaReference}
                    {mostrarComercial ? ` · ${item.comercialNombre}` : ""}
                    {dias != null ? ` · ${textoAging(dias)}` : ""}
                  </p>
                  {item.proximaAccion ? (
                    <p className="mt-0.5 text-[12px] text-[#0B7461]">
                      {item.proximaAccion}
                      {item.proximaAccionEn ? ` · ${item.proximaAccionEn}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#F6F5F1] px-2.5 py-1 text-[11px] font-semibold text-[#131C1A]">
                    {ESTADO_CAPTACION_LABEL[item.estado]}
                  </span>
                  {item.propertyId ? (
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                      Propiedad
                    </span>
                  ) : null}
                </div>
              </Link>
              {item.propertyId ? (
                <div className="px-4 pb-3">
                  <Link href={rutaPropiedadCrm(item.propertyId)} className="text-[12px] font-medium text-[#0B7461] hover:underline">
                    Ver inmueble
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
        {visibles.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-[#5D6B67]">No hay fincas en este filtro.</li>
        ) : null}
      </ul>
    </div>
  );
}
