"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ETIQUETA_BLOQUE, type BloqueWeb, type ContenidoBloque, type TipoBloque } from "@/lib/web/modelo";
import { cn } from "@/lib/utils";

export type EdicionSitio = {
  bloques: BloqueWeb[];
  seleccionado: string | null;
  pendiente: boolean;
  onSeleccionar: (id: string) => void;
  onPatch: (id: string, cambio: Partial<ContenidoBloque>) => void;
  onMover: (id: string, direccion: "arriba" | "abajo") => void;
  onVisible: (id: string, visible: boolean) => void;
  onFoto: (id: string, archivo: File) => void;
  onQuitarFoto: (id: string, path: string) => void;
};

export function EdicionBloque({
  bloque,
  edicion,
  children,
  permiteFoto,
}: {
  bloque: BloqueWeb;
  edicion: EdicionSitio;
  children: ReactNode;
  permiteFoto?: boolean;
}) {
  const indice = edicion.bloques.findIndex((item) => item.id === bloque.id);
  const activo = edicion.seleccionado === bloque.id;
  const primero = indice <= 0;
  const ultimo = indice < 0 || indice >= edicion.bloques.length - 1;

  return (
    <div
      className={cn(
        "group/bloque relative scroll-mt-24 transition-opacity",
        !bloque.visible && "opacity-45",
        activo && "z-10 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
      )}
      onClick={(e) => {
        e.stopPropagation();
        edicion.onSeleccionar(bloque.id);
      }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 py-2 opacity-0 transition-opacity",
          "group-hover/bloque:opacity-100",
          activo && "opacity-100"
        )}
      >
        <span className="pointer-events-auto rounded-md bg-black/75 px-2 py-1 text-[11px] font-medium text-white">
          {ETIQUETA_BLOQUE[bloque.tipo]}
          {!bloque.visible ? " · oculto" : ""}
        </span>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-md bg-black/75 p-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
            disabled={edicion.pendiente || primero}
            aria-label="Subir bloque"
            onClick={(e) => {
              e.stopPropagation();
              edicion.onMover(bloque.id, "arriba");
            }}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
            disabled={edicion.pendiente || ultimo}
            aria-label="Bajar bloque"
            onClick={(e) => {
              e.stopPropagation();
              edicion.onMover(bloque.id, "abajo");
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
            disabled={edicion.pendiente}
            aria-label={bloque.visible ? "Ocultar bloque" : "Mostrar bloque"}
            onClick={(e) => {
              e.stopPropagation();
              edicion.onVisible(bloque.id, !bloque.visible);
            }}
          >
            {bloque.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          {permiteFoto ? (
            <label className="flex h-7 cursor-pointer items-center rounded-md px-2 text-[11px] font-medium text-white hover:bg-white/15">
              Foto
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={edicion.pendiente}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo) edicion.onFoto(bloque.id, archivo);
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function BotonQuitarFoto({
  path,
  onQuitar,
  disabled,
}: {
  path: string;
  onQuitar: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white"
      onClick={(e) => {
        e.stopPropagation();
        onQuitar();
      }}
    >
      Quitar
    </button>
  );
}

export function tiposConTitulo(tipo: TipoBloque): boolean {
  return tipo === "hero" || tipo === "texto" || tipo === "inmuebles" || tipo === "galeria" || tipo === "contacto";
}
