"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { acceptMedia, type TipoMediaInmueble } from "@/lib/inmuebles/media";
import {
  arrastrandoArchivos,
  claveArchivo,
  esImagenArchivo,
  esPdfArchivo,
  fusionarArchivos,
  reordenarIndice,
  validarArchivosEntrada,
} from "@/lib/inmuebles/archivos-pendientes";
import { cn } from "@/lib/utils";

export function ZonaArchivosPendientes({
  tipo,
  files,
  onChange,
}: {
  tipo: Extract<TipoMediaInmueble, "foto" | "plano">;
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sueltaActiva, setSueltaActiva] = useState(false);
  const [arrastrandoIdx, setArrastrandoIdx] = useState<number | null>(null);
  const [destinoIdx, setDestinoIdx] = useState<number | null>(null);

  const etiqueta = tipo === "plano" ? "plano" : "foto";
  const etiquetaPlural = tipo === "plano" ? "planos" : "fotos";

  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of files) {
      if (esImagenArchivo(file)) map.set(claveArchivo(file), URL.createObjectURL(file));
    }
    return map;
  }, [files]);

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
    onChange(fusionarArchivos(files, ok));
  };

  const quitar = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const soltarEnZona = (e: React.DragEvent) => {
    e.preventDefault();
    setSueltaActiva(false);
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
  };

  const soltarEnMiniatura = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDestinoIdx(null);
    if (arrastrandoIdx != null && arrastrandoIdx !== idx) {
      onChange(reordenarIndice(files, arrastrandoIdx, idx));
      setArrastrandoIdx(null);
      return;
    }
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
  };

  return (
    <div className="mt-2">
      {files.length ? (
        <ul className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file, idx) => {
            const key = claveArchivo(file);
            const preview = previews.get(key);
            const esPortada = tipo === "foto" && idx === 0;
            const resaltada = destinoIdx === idx && arrastrandoIdx != null && arrastrandoIdx !== idx;
            return (
              <li
                key={key}
                draggable
                onDragStart={() => setArrastrandoIdx(idx)}
                onDragEnd={() => {
                  setArrastrandoIdx(null);
                  setDestinoIdx(null);
                }}
                onDragOver={(e) => {
                  if (arrastrandoIdx == null) return;
                  e.preventDefault();
                  setDestinoIdx(idx);
                }}
                onDragLeave={() => {
                  if (destinoIdx === idx) setDestinoIdx(null);
                }}
                onDrop={(e) => soltarEnMiniatura(e, idx)}
                className={cn(
                  "group relative cursor-grab overflow-hidden rounded-[12px] border bg-[var(--surface-soft)] active:cursor-grabbing",
                  resaltada ? "border-accent ring-2 ring-accent/30" : "border-[var(--border)]"
                )}
              >
                {preview ? (
                  <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center px-2 text-center text-[12px] font-medium text-[var(--text-2)]">
                    {esPdfArchivo(file) ? "PDF" : file.name}
                  </div>
                )}
                {esPortada ? (
                  <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Portada
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => quitar(idx)}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Quitar ${etiqueta}`}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          if (!arrastrandoArchivos(e.dataTransfer)) return;
          e.preventDefault();
          setSueltaActiva(true);
        }}
        onDragOver={(e) => {
          if (!arrastrandoArchivos(e.dataTransfer)) return;
          e.preventDefault();
          setSueltaActiva(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setSueltaActiva(false);
        }}
        onDrop={soltarEnZona}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-[12px] border border-dashed px-4 py-8 text-center transition-[border,background]",
          sueltaActiva
            ? "border-accent bg-accent-soft"
            : "border-[var(--input)] bg-[var(--field)] hover:border-[var(--border)] hover:bg-[var(--surface-soft)]"
        )}
      >
        <ImagePlus className="mb-2 h-6 w-6 text-[var(--text-2)]" strokeWidth={1.5} />
        <p className="text-[13.5px] font-medium text-foreground">
          {files.length ? `Añadir más ${etiquetaPlural}` : `Arrastra ${etiquetaPlural} aquí`}
        </p>
        <p className="mt-1 max-w-[22rem] text-[12.5px] leading-5 text-[var(--text-2)]">
          {tipo === "foto"
            ? "O pulsa para elegir archivos. La primera es la portada; arrastra las miniaturas para reordenar."
            : "PDF o imagen. Puedes soltar varios a la vez."}
        </p>
        {files.length ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--text-2)]">
            {files.length} {files.length === 1 ? etiqueta : etiquetaPlural} en esta sesión
          </p>
        ) : null}
      </div>

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
