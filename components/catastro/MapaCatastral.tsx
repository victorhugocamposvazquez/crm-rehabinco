"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { crearUrlMapaCatastral } from "@/lib/catastro/explorer/catastro-map";
import { fetchMapaCatastral } from "@/lib/catastro/explorer/history-ui";

export function MapaCatastral({
  fincaReference,
  alto = "h-44",
}: {
  fincaReference: string;
  alto?: string;
}) {
  const mapa = crearUrlMapaCatastral(fincaReference);
  const caja = useRef<HTMLFigureElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) setVisible(true);
      },
      { rootMargin: "120px" }
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    setError(false);
    fetchMapaCatastral(fincaReference, controller.signal)
      .then((data) => setImageUrl(data.imageUrl))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(true);
      });
    return () => controller.abort();
  }, [visible, fincaReference]);

  if (!mapa) return null;

  return (
    <figure ref={caja} className="overflow-hidden rounded-xl border border-border bg-neutral-50">
      {imageUrl ? (
        <a href={mapa} target="_blank" rel="noreferrer" className="block">
          <img
            src={imageUrl}
            alt={`Cartografía catastral de ${fincaReference}`}
            className={`w-full object-cover ${alto}`}
          />
        </a>
      ) : (
        <div className={`flex ${alto} items-center justify-center px-4 text-center`}>
          <p className="text-sm text-neutral-500">
            {error
              ? "No se ha podido incrustar el mapa. Ábrelo en Catastro."
              : "Cargando cartografía oficial…"}
          </p>
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
          Abrir mapa
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}
