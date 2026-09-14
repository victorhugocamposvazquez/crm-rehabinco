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
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  if (!mapa) return null;

  const cargar = () => {
    setEstado("cargando");
    setMostrar(true);
  };

  const reintentar = () => {
    setEstado("cargando");
    setIntento((n) => n + 1);
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-[#E6E3DD] bg-[#F4F3EF]">
      {mostrar ? (
        <div className="relative aspect-[4/3] overflow-hidden min-[780px]:aspect-[16/10]">
          {estado !== "error" ? (
            <a href={mapa} target="_blank" rel="noreferrer" className="absolute inset-0 block">
              <img
                key={intento}
                src={`/api/catastro/fincas/${encodeURIComponent(fincaReference)}/mapa?img=1&n=${intento}`}
                alt={estado === "ok" ? `Cartografía catastral de ${fincaReference}` : ""}
                onLoad={() => setEstado("ok")}
                onError={() => setEstado("error")}
                className={
                  estado === "ok"
                    ? "absolute inset-0 h-full w-full object-cover"
                    : "absolute inset-0 h-full w-full opacity-0"
                }
              />
              {superficie && estado === "ok" ? (
                <span className="absolute bottom-2 left-2 rounded-md bg-[#0B7461] px-2 py-0.5 text-[11px] font-semibold text-white shadow">
                  {superficie}
                </span>
              ) : null}
            </a>
          ) : null}
          {estado === "cargando" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#DAD6CE] border-t-[#0B7461]" aria-hidden />
              <p className="text-sm text-[#5D6B67]">Cargando cartografía…</p>
            </div>
          ) : null}
          {estado === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm text-[#5D6B67]">Catastro no ha enviado el mapa esta vez.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button type="button" size="sm" onClick={reintentar}>
                  Reintentar
                </Button>
                <Button type="button" size="sm" variant="secondary" asChild>
                  <a href={mapa} target="_blank" rel="noreferrer">
                    Abrir en Catastro
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`flex ${alto} flex-col items-center justify-center gap-3 px-4 text-center`}>
          <p className="text-sm text-[#5D6B67]">Cartografía oficial del Catastro</p>
          <Button type="button" size="sm" onClick={cargar}>
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
