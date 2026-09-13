"use client";

import { ExternalLink } from "lucide-react";
import {
  crearUrlCroquisCatastral,
  crearUrlMapaCatastral,
} from "@/lib/catastro/explorer/catastro-map";

export function MapaCatastral({
  fincaReference,
  alto = "h-44",
}: {
  fincaReference: string;
  alto?: string;
}) {
  const mapa = crearUrlMapaCatastral(fincaReference);
  const croquis = crearUrlCroquisCatastral(fincaReference);
  if (!mapa || !croquis) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-neutral-50">
      <iframe
        title={`Mapa catastral de ${fincaReference}`}
        src={croquis}
        className={`w-full border-0 ${alto}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <figcaption className="flex items-center justify-between gap-2 border-t border-border bg-white px-3 py-2">
        <span className="text-xs text-neutral-500">Cartografía oficial del Catastro</span>
        <a
          href={mapa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          Abrir mapa
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}
