"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  AyudaOrdenGaleria,
  ListaMiniaturasOrden,
  MiniaturaGaleriaOrden,
} from "@/components/inmuebles/MiniaturaGaleriaOrden";
import { acceptMedia, type TipoMediaInmueble } from "@/lib/inmuebles/media";
import { abrirSelectorArchivos } from "@/lib/inmuebles/selector-archivos";
import { prepararFotosParaSubida } from "@/lib/inmuebles/preparar-foto";
import {
  activarSolturaArchivos,
  arrastrandoArchivos,
  claveArchivo,
  esImagenArchivo,
  esPdfArchivo,
  fusionarArchivos,
  reordenarIndice,
  validarArchivosEntrada,
} from "@/lib/inmuebles/archivos-pendientes";
import { useReordenarPuntero } from "@/lib/inmuebles/reordenar-puntero";
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
  const filesRef = useRef(files);
  filesRef.current = files;
  const [sueltaActiva, setSueltaActiva] = useState(false);
  const reordenar = useReordenarPuntero((desde, hasta) => {
    onChange(reordenarIndice(filesRef.current, desde, hasta));
  });
  const arrastrando = reordenar.desde != null;

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
    const entrantes = Array.from(lista);
    void (async () => {
      const preparados = tipo === "foto" ? await prepararFotosParaSubida(entrantes) : entrantes;
      const { ok, errores } = validarArchivosEntrada(tipo, preparados);
      for (const err of errores) toast.error(err);
      if (!ok.length) return;
      onChange(fusionarArchivos(filesRef.current, ok));
    })();
  };

  const quitar = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const mover = (idx: number, dir: -1 | 1) => {
    const dest = idx + dir;
    if (dest < 0 || dest >= filesRef.current.length) return;
    onChange(reordenarIndice(filesRef.current, idx, dest));
  };

  const soltarEnZona = (e: React.DragEvent) => {
    activarSolturaArchivos(e);
    setSueltaActiva(false);
    if (arrastrandoArchivos(e.dataTransfer)) ingestar(e.dataTransfer.files);
  };

  return (
    <div
      className="mt-2"
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
      onDrop={soltarEnZona}
    >
      {files.length ? (
        <>
          <AyudaOrdenGaleria tipo={tipo} total={files.length} arrastrando={arrastrando} />
          <ListaMiniaturasOrden listaRef={reordenar.listaRef} arrastrando={arrastrando}>
            {files.map((file, idx) => {
              const key = claveArchivo(file);
              const preview = previews.get(key);
              const esPortada = tipo === "foto" && idx === 0;
              const resaltada = reordenar.hasta === idx && reordenar.desde != null && reordenar.desde !== idx;
              return (
                <MiniaturaGaleriaOrden
                  key={key}
                  idx={idx}
                  total={files.length}
                  tipo={tipo}
                  esPortada={esPortada}
                  resaltada={resaltada}
                  esOrigen={reordenar.desde === idx}
                  onPointerDown={reordenar.alBajar(idx)}
                  onPortada={() => {
                    if (reordenar.fueArrastre()) return;
                    onChange(reordenarIndice(filesRef.current, idx, 0));
                  }}
                  onMover={(dir) => mover(idx, dir)}
                  onQuitar={() => {
                    if (reordenar.fueArrastre()) return;
                    quitar(idx);
                  }}
                >
                  {preview ? (
                    <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center px-2 text-center text-[12px] font-medium text-[var(--text-2)]">
                      {esPdfArchivo(file) ? "PDF" : file.name}
                    </div>
                  )}
                </MiniaturaGaleriaOrden>
              );
            })}
          </ListaMiniaturasOrden>
        </>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() =>
          abrirSelectorArchivos({
            accept: acceptMedia(tipo),
            onFiles: (elegidos) => ingestar(elegidos),
          })
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrirSelectorArchivos({
              accept: acceptMedia(tipo),
              onFiles: (elegidos) => ingestar(elegidos),
            });
          }
        }}
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
        <p className="mt-1 max-w-[26rem] text-[12.5px] leading-5 text-[var(--text-2)]">
          {tipo === "foto"
            ? "La foto n.º 1 es la portada en web e Idealista. Después de subir, usa las flechas o arrastra para ordenar."
            : "PDF o imagen. Puedes soltar varios a la vez."}
        </p>
        {files.length ? (
          <p className="mt-2 text-[12px] font-medium text-[var(--text-2)]">
            {files.length} {files.length === 1 ? etiqueta : etiquetaPlural} en esta sesión
          </p>
        ) : null}
      </div>
    </div>
  );
}
