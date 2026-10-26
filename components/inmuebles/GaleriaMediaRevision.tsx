"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import {
  AyudaOrdenGaleria,
  ListaMiniaturasOrden,
  MiniaturaGaleriaOrden,
} from "@/components/inmuebles/MiniaturaGaleriaOrden";
import { toast } from "sonner";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { acceptMedia, type TipoMediaInmueble } from "@/lib/inmuebles/media";
import { abrirSelectorArchivos } from "@/lib/inmuebles/selector-archivos";
import { prepararFotosParaSubida } from "@/lib/inmuebles/preparar-foto";
import {
  activarSolturaArchivos,
  arrastrandoArchivos,
  esImagenArchivo,
  esPdfArchivo,
  validarArchivosEntrada,
} from "@/lib/inmuebles/archivos-pendientes";
import type { RevisionMediaTipo } from "@/lib/inmuebles/revision-media";
import { useReordenarPuntero } from "@/lib/inmuebles/reordenar-puntero";
import { anadirArchivosRevision, quitarFilaRevision, reordenarFilasRevision } from "@/lib/inmuebles/revision-media";
import { cn } from "@/lib/utils";

function esImagenMedia(item: InmuebleMedia) {
  const src = `${item.path} ${item.url}`.toLowerCase();
  return !src.includes(".pdf");
}

export function GaleriaMediaRevision({
  tipo,
  revision,
  onChange,
}: {
  tipo: Extract<TipoMediaInmueble, "foto" | "plano">;
  revision: RevisionMediaTipo;
  onChange: (next: RevisionMediaTipo) => void;
}) {
  const revisionRef = useRef(revision);
  revisionRef.current = revision;
  const [sueltaActiva, setSueltaActiva] = useState(false);
  const reordenar = useReordenarPuntero((desde, hasta) => {
    onChange(reordenarFilasRevision(revisionRef.current, desde, hasta));
  });
  const arrastrando = reordenar.desde != null;

  const etiqueta = tipo === "plano" ? "plano" : "foto";
  const etiquetaPlural = tipo === "plano" ? "planos" : "fotos";
  const { filas } = revision;

  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const fila of filas) {
      if (fila.origen === "nuevo" && esImagenArchivo(fila.file)) {
        map.set(fila.id, URL.createObjectURL(fila.file));
      }
    }
    return map;
  }, [filas]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  const ingestar = (lista: FileList | File[] | null) => {
    if (!lista?.length) return;
    const entrantes = Array.from(lista);
    void (async () => {
      const preparados = tipo === "foto" ? await prepararFotosParaSubida(entrantes) : entrantes;
      const { ok, errores } = validarArchivosEntrada(tipo, preparados);
      for (const err of errores) toast.error(err);
      if (!ok.length) return;
      onChange(anadirArchivosRevision(revisionRef.current, ok));
    })();
  };

  const soltarArchivos = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSueltaActiva(false);
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
  };

  const mover = (idx: number, dir: -1 | 1) => {
    const dest = idx + dir;
    if (dest < 0 || dest >= revisionRef.current.filas.length) return;
    onChange(reordenarFilasRevision(revisionRef.current, idx, dest));
  };

  return (
    <div
      onDragEnter={(e) => {
        if (!arrastrandoArchivos(e.dataTransfer)) return;
        activarSolturaArchivos(e);
        setSueltaActiva(true);
      }}
      onDragOver={(e) => {
        if (!arrastrandoArchivos(e.dataTransfer)) return;
        activarSolturaArchivos(e);
        setSueltaActiva(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setSueltaActiva(false);
      }}
      onDrop={soltarArchivos}
      className={cn(
        "rounded-[12px] transition-[box-shadow,background]",
        sueltaActiva && "bg-accent-soft ring-2 ring-accent/35 ring-offset-2 ring-offset-[var(--surface)]"
      )}
    >
      {filas.length ? (
        <>
          <AyudaOrdenGaleria tipo={tipo} total={filas.length} arrastrando={arrastrando} />
          <ListaMiniaturasOrden listaRef={reordenar.listaRef} arrastrando={arrastrando}>
            {filas.map((fila, idx) => {
              const resaltada = reordenar.hasta === idx && reordenar.desde != null && reordenar.desde !== idx;
              const esPortada = tipo === "foto" && idx === 0;
              const preview =
                fila.origen === "nuevo"
                  ? previews.get(fila.id)
                  : esImagenMedia(fila.media)
                    ? fila.media.url
                    : null;
              return (
                <MiniaturaGaleriaOrden
                  key={fila.id}
                  idx={idx}
                  total={filas.length}
                  tipo={tipo}
                  esPortada={esPortada}
                  resaltada={resaltada}
                  esOrigen={reordenar.desde === idx}
                  onPointerDown={reordenar.alBajar(idx)}
                  onPortada={() => {
                    if (reordenar.fueArrastre()) return;
                    onChange(reordenarFilasRevision(revisionRef.current, idx, 0));
                  }}
                  onMover={(dir) => mover(idx, dir)}
                  onQuitar={() => {
                    if (reordenar.fueArrastre()) return;
                    onChange(quitarFilaRevision(revisionRef.current, fila.id));
                  }}
                  quitarClassName="rounded-full bg-white/90 p-1.5 text-red-700 grid h-auto w-auto place-items-center"
                  extraBadge={
                    fila.origen === "nuevo" ? (
                      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Nueva
                      </span>
                    ) : null
                  }
                >
                  {preview ? (
                    <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center px-2 text-center text-[12px] font-medium text-[var(--text-2)]">
                      {fila.origen === "nuevo" && esPdfArchivo(fila.file) ? "PDF" : "Plano"}
                    </div>
                  )}
                </MiniaturaGaleriaOrden>
              );
            })}
          </ListaMiniaturasOrden>
        </>
      ) : null}

      <button
        type="button"
        onClick={() =>
          abrirSelectorArchivos({
            accept: acceptMedia(tipo),
            onFiles: (elegidos) => ingestar(elegidos),
          })
        }
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-[12px] border border-dashed px-4 py-8 text-center transition-[border,background]",
          sueltaActiva
            ? "border-accent bg-accent-soft"
            : "border-[var(--input)] bg-[var(--field)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
        )}
      >
        <ImagePlus className="mb-2 h-6 w-6 text-[var(--text-2)]" strokeWidth={1.5} />
        <p className="text-[13.5px] font-medium text-foreground">
          {filas.length ? `Añadir más ${etiquetaPlural}` : `Arrastra ${etiquetaPlural} aquí`}
        </p>
        <p className="mt-1 max-w-[24rem] text-[12.5px] leading-5 text-[var(--text-2)]">
          {tipo === "foto"
            ? "Flechas ← →, arrastre o clic en la foto para portada. Guarda los cambios abajo."
            : "PDF o imagen. Varios a la vez; guarda los cambios cuando acabes."}
        </p>
      </button>

    </div>
  );
}
