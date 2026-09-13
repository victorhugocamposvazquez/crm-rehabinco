"use client";

import { useState } from "react";
import {
  LEYENDA_ESTADOS_DIVISION,
  LEYENDA_FILTRO_TODAS,
  TITULO_LEYENDA_DIVISION,
  clasePuntoDivision,
  claseTextoDivision,
} from "@/lib/catastro/search-ui";
import { cn } from "@/lib/utils";

export function LeyendaEstadosDivision({
  abiertaPorDefecto = false,
  compacta = false,
}: {
  abiertaPorDefecto?: boolean;
  compacta?: boolean;
}) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto);
  if (compacta) {
    return (
      <div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-[#0B7461] hover:underline"
          onClick={() => setAbierta((prev) => !prev)}
        >
          {abierta ? "Ocultar estados" : TITULO_LEYENDA_DIVISION}
        </button>
        {abierta ? (
          <div className="mt-3 grid gap-3.5 rounded-xl border border-[#E6E3DD] bg-white p-3.5 min-[780px]:grid-cols-2 min-[780px]:border-0 min-[780px]:bg-[#FBFBF9] min-[780px]:p-4 xl:grid-cols-4">
            {LEYENDA_ESTADOS_DIVISION.map((item) => (
              <div key={item.status}>
                <p className={cn("flex items-center gap-2 text-[13px] font-semibold", claseTextoDivision(item.status))}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", clasePuntoDivision(item.status))} aria-hidden />
                  {item.filtro}
                </p>
                <p className="mt-1 text-xs leading-snug text-[#5D6B67]">{item.texto}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="leyenda-division-titulo" className="mt-4 rounded-2xl border border-[#E6E3DD] bg-[#FBFBF9] px-4 py-3.5">
      <h2 id="leyenda-division-titulo" className="text-sm font-semibold text-[#131C1A]">
        {TITULO_LEYENDA_DIVISION}
      </h2>
      <p className="mt-1 text-xs text-[#5D6B67]">{LEYENDA_FILTRO_TODAS}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {LEYENDA_ESTADOS_DIVISION.map((item) => (
          <li key={item.status} className="min-w-0">
            <span className={cn("inline-flex items-center gap-2 text-[12.5px] font-semibold", claseTextoDivision(item.status))}>
              <span className={cn("h-1.5 w-1.5 rounded-full", clasePuntoDivision(item.status))} aria-hidden />
              {item.filtro}
            </span>
            <p className="mt-1 text-xs leading-snug text-[#5D6B67]">{item.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
