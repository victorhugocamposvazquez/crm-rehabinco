"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crearUrlMapaCatastral } from "@/lib/catastro/explorer/catastro-map";

export function MapaCatastral({
  fincaReference,
  alto = "h-44",
  superficie,
}: {
  fincaReference: string;
  alto?: string;
  superficie?: string;
}) {
  const mapa = crearUrlMapaCatastral(fincaReference);
  const [mostrar, setMostrar] = useState(false);
  if (!mapa) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-[#E6E3DD] bg-[#F4F3EF]">
      {mostrar ? (
        <a href={mapa} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] overflow-hidden min-[780px]:aspect-[16/10]">
          <img
            src={`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/mapa?img=1`}
            alt={`Cartografía catastral de ${fincaReference}`}
            className="absolute inset-0 h-full w-full object-cover [filter:saturate(.18)_contrast(1.06)_brightness(1.03)]"
          />
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_46%_46%_at_50%_50%,rgba(244,243,239,0)_40%,rgba(244,243,239,.74)_100%)]" />
          {superficie ? (
            <span className="absolute left-1/2 top-[36%] -translate-x-1/2 rounded-md bg-[#0B7461] px-2 py-0.5 text-[11px] font-semibold text-white shadow">
              {superficie}
            </span>
          ) : null}
        </a>
      ) : (
        <div className={`flex ${alto} flex-col items-center justify-center gap-3 px-4 text-center`}>
          <p className="text-sm text-[#5D6B67]">Cartografía oficial del Catastro</p>
          <Button type="button" size="sm" onClick={() => setMostrar(true)}>
            Ver cartografía
          </Button>
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-2 border-t border-[#EFEDE7] bg-white px-3 py-2">
        <span className="text-xs text-[#5D6B67]">Sede Electrónica del Catastro</span>
        <a
          href={mapa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          Abrir en Catastro
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}
