"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { crearUrlMapaCatastral } from "@/lib/catastro/explorer/catastro-map";

export function MapaCatastral({
  fincaReference,
  alto = "h-44",
}: {
  fincaReference: string;
  alto?: string;
}) {
  const mapa = crearUrlMapaCatastral(fincaReference);
  const [mostrar, setMostrar] = useState(false);
  if (!mapa) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-neutral-50">
      {mostrar ? (
        <a href={mapa} target="_blank" rel="noreferrer" className="block">
          <img
            src={`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/mapa?img=1`}
            alt={`Cartografía catastral de ${fincaReference}`}
            className={`w-full bg-neutral-100 object-cover ${alto}`}
          />
        </a>
      ) : (
        <div className={`flex ${alto} flex-col items-center justify-center gap-3 px-4 text-center`}>
          <p className="text-sm text-neutral-600">Cartografía oficial del Catastro</p>
          <Button type="button" size="sm" onClick={() => setMostrar(true)}>
            Ver cartografía
          </Button>
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-2 border-t border-border bg-white px-3 py-2">
        <span className="text-xs text-neutral-500">Cartografía oficial del Catastro</span>
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
