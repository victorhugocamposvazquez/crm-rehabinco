"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { acceptMedia, type TipoMediaInmueble } from "@/lib/inmuebles/media";
import {
  activarSolturaArchivos,
  arrastrandoArchivos,
  claveArchivo,
  esImagenArchivo,
  esPdfArchivo,
  validarArchivosEntrada,
} from "@/lib/inmuebles/archivos-pendientes";
import type { RevisionMediaTipo } from "@/lib/inmuebles/revision-media";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [sueltaActiva, setSueltaActiva] = useState(false);
  const [arrastrandoIdx, setArrastrandoIdx] = useState<number | null>(null);
  const [destinoIdx, setDestinoIdx] = useState<number | null>(null);

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
    const { ok, errores } = validarArchivosEntrada(tipo, Array.from(lista));
    for (const err of errores) toast.error(err);
    if (!ok.length) return;
    onChange(anadirArchivosRevision(revision, ok));
  };

  const soltarArchivos = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSueltaActiva(false);
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
  };

  const soltarEnFila = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDestinoIdx(null);
    if (arrastrandoIdx != null && arrastrandoIdx !== idx) {
      onChange(reordenarFilasRevision(revision, arrastrandoIdx, idx));
      setArrastrandoIdx(null);
      return;
    }
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
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
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filas.map((fila, idx) => {
            const resaltada = destinoIdx === idx && arrastrandoIdx != null && arrastrandoIdx !== idx;
            const esPortada = tipo === "foto" && idx === 0;
            const preview =
              fila.origen === "nuevo"
                ? previews.get(fila.id)
                : esImagenMedia(fila.media)
                  ? fila.media.url
                  : null;
            return (
              <li
                key={fila.id}
                draggable
                onDragStart={() => setArrastrandoIdx(idx)}
                onDragEnd={() => {
                  setArrastrandoIdx(null);
                  setDestinoIdx(null);
                }}
                onDragOver={(e) => {
                  if (arrastrandoIdx != null) {
                    activarSolturaArchivos(e);
                    setDestinoIdx(idx);
                    return;
                  }
                  if (arrastrandoArchivos(e.dataTransfer)) activarSolturaArchivos(e);
                }}
                onDragLeave={() => {
                  if (destinoIdx === idx) setDestinoIdx(null);
                }}
                onDrop={(e) => soltarEnFila(e, idx)}
                className={cn(
                  "group relative cursor-grab overflow-hidden rounded-[12px] border bg-[var(--surface-soft)] active:cursor-grabbing",
                  resaltada ? "border-accent ring-2 ring-accent/30" : "border-[var(--border)]",
                  fila.origen === "nuevo" && "ring-1 ring-dashed ring-[var(--border)]"
                )}
              >
                {preview ? (
                  <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center px-2 text-center text-[12px] font-medium text-[var(--text-2)]">
                    {fila.origen === "nuevo" && esPdfArchivo(fila.file) ? "PDF" : "Plano"}
                  </div>
                )}
                {fila.origen === "nuevo" ? (
                  <span className="absolute left-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Nueva
                  </span>
                ) : null}
                {esPortada ? (
                  <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Portada
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onChange(quitarFilaRevision(revision, fila.id))}
                    className="rounded-full bg-white/90 p-1.5 text-red-700"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
            ? "Suelta archivos o pulsa para elegir. La primera miniatura es la portada: arrástrala arriba si hace falta. Guarda los cambios abajo."
            : "PDF o imagen. Varios a la vez; guarda los cambios cuando acabes."}
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={acceptMedia(tipo)}
        multiple
        className="hidden"
        onChange={(e) => {
          ingestar(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
