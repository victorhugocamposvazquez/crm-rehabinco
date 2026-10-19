"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InmuebleMedia } from "@/lib/inmuebles/catalogo";
import { acceptMedia, esPathExterno, moverMedia, type TipoMediaInmueble } from "@/lib/inmuebles/media";
import { activarSolturaArchivos, arrastrandoArchivos } from "@/lib/inmuebles/archivos-pendientes";
import { cn } from "@/lib/utils";
import { sincronizarPortadaEnDb, sincronizarPortadaMemoria } from "@/lib/inmuebles/portada";
import { abrirSelectorArchivos } from "@/lib/inmuebles/selector-archivos";
import { subirArchivosMedia } from "@/lib/inmuebles/subir-media";

function esImagen(item: InmuebleMedia) {
  if (item.tipo === "video") return false;
  const src = `${item.path} ${item.url}`.toLowerCase();
  return !src.includes(".pdf");
}

export function InmuebleGaleria({
  propiedadId,
  userId,
  media,
  onChange,
  tipo = "foto",
}: {
  propiedadId: string;
  userId: string;
  media: InmuebleMedia[];
  onChange: (next: InmuebleMedia[]) => void;
  tipo?: TipoMediaInmueble;
}) {
  const [busy, setBusy] = useState(false);
  const [sueltaActiva, setSueltaActiva] = useState(false);
  const [visor, setVisor] = useState<number | null>(null);
  const items = media.filter((m) => m.tipo === tipo).sort((a, b) => a.orden - b.orden);
  const imagenes = items.filter(esImagen);

  const etiqueta =
    tipo === "plano" ? "plano" : tipo === "video" ? "vídeo" : "foto";
  const etiquetaPlural = tipo === "plano" ? "planos" : tipo === "video" ? "vídeos" : "fotos";

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const { media: next, errores } = await subirArchivosMedia({
        propiedadId,
        userId,
        files,
        tipo,
        media,
      });
      for (const err of errores) toast.error(err);
      onChange(next);
    } finally {
      setBusy(false);
    }
  };

  const elegir = () => {
    abrirSelectorArchivos({
      accept: acceptMedia(tipo),
      onFiles: (elegidos) => void upload(elegidos),
    });
  };

  const remove = async (item: InmuebleMedia) => {
    const supabase = createClient();
    await supabase.from("inmueble_media").delete().eq("id", item.id);
    if (!esPathExterno(item.path)) {
      await supabase.storage.from("inmuebles").remove([item.path]);
    }
    let next = media.filter((m) => m.id !== item.id);
    if (tipo === "foto") {
      await sincronizarPortadaEnDb(propiedadId);
      next = sincronizarPortadaMemoria(next);
    }
    onChange(next);
  };

  const mover = async (id: string, dir: -1 | 1) => {
    const nextItems = moverMedia(items, id, dir);
    if (!nextItems) return;
    const supabase = createClient();
    await Promise.all(nextItems.map((item) => supabase.from("inmueble_media").update({ orden: item.orden }).eq("id", item.id)));
    const porId = new Map(nextItems.map((item) => [item.id, item.orden]));
    let next = media.map((m) => (porId.has(m.id) ? { ...m, orden: porId.get(m.id)! } : m));
    if (tipo === "foto") {
      await sincronizarPortadaEnDb(propiedadId);
      next = sincronizarPortadaMemoria(next);
    }
    onChange(next);
  };

  const visorItem = visor != null ? imagenes[visor] : null;

  const soltarArchivos = (e: React.DragEvent) => {
    activarSolturaArchivos(e);
    setSueltaActiva(false);
    if (!arrastrandoArchivos(e.dataTransfer)) return;
    void upload(e.dataTransfer.files);
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
      className={cn(sueltaActiva && items.length > 0 && "rounded-2xl bg-accent-soft/40 p-2 ring-2 ring-accent/25")}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {items.length} {items.length === 1 ? etiqueta : etiquetaPlural}
        </p>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={elegir}>
          <ImagePlus className="mr-1.5 h-4 w-4" strokeWidth={1.5} />
          {busy ? "Subiendo…" : `Añadir ${etiquetaPlural}`}
        </Button>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={elegir}
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
            "flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-sm transition-[border,background]",
            sueltaActiva ? "border-accent bg-accent-soft text-foreground" : "border-border bg-white text-neutral-500 hover:bg-neutral-50"
          )}
        >
          {tipo === "plano"
            ? "Arrastra planos aquí o pulsa para subir (PDF o imagen)."
            : tipo === "video"
              ? "Sube un MP4 o WebM, o pega la URL en Vídeo."
              : "Arrastra fotos aquí o pulsa para subir. La primera será la portada."}
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((f, i) => (
            <li key={f.id} className="group relative overflow-hidden rounded-xl bg-neutral-100">
              {esImagen(f) ? (
                <button type="button" className="block w-full" onClick={() => setVisor(imagenes.findIndex((x) => x.id === f.id))}>
                  <img src={f.url} alt="" className="aspect-[4/3] w-full object-cover" />
                </button>
              ) : f.tipo === "video" ? (
                <video src={f.url} className="aspect-[4/3] w-full object-cover" muted playsInline />
              ) : (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-[4/3] items-center justify-center px-3 text-center text-[13px] font-medium text-[var(--text-2)]"
                >
                  Abrir plano PDF
                </a>
              )}
              {tipo === "foto" && i === 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Portada
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                {i > 0 ? (
                  <button type="button" onClick={() => void mover(f.id, -1)} className="rounded-full bg-white/90 p-1.5 text-neutral-800" aria-label="Anterior">
                    <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
                {i < items.length - 1 ? (
                  <button type="button" onClick={() => void mover(f.id, 1)} className="rounded-full bg-white/90 p-1.5 text-neutral-800" aria-label="Siguiente">
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                ) : null}
                <button type="button" onClick={() => void remove(f)} className="rounded-full bg-white/90 p-1.5 text-red-700" aria-label="Quitar">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {visorItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setVisor(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
        >
          <img src={visorItem.url} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          {visor != null && visor > 0 ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                setVisor(visor - 1);
              }}
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {visor != null && visor < imagenes.length - 1 ? (
            <button
              type="button"
              className="absolute right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                setVisor(visor + 1);
              }}
              aria-label="Foto siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
