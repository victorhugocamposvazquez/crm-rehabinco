"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import "./galeria-orden.css";

export function AyudaOrdenGaleria({
  tipo,
  total,
  arrastrando,
}: {
  tipo: "foto" | "plano";
  total: number;
  arrastrando: boolean;
}) {
  if (total < 2) return null;
  return (
    <p
      className={cn(
        "galeria-orden-hint mb-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[12.5px] leading-snug text-[var(--text-2)]",
        arrastrando && "border-accent/40 bg-accent-soft text-foreground"
      )}
    >
      {arrastrando ? (
        <>
          <span className="font-semibold text-foreground">Suelta</span> sobre la miniatura resaltada (borde discontinuo) para
          colocar la foto ahí.
        </>
      ) : tipo === "foto" ? (
        <>
          <span className="font-semibold text-foreground">Orden:</span> usa las flechas ← →, arrastra desde{" "}
          <GripVertical className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> o pulsa una foto para hacerla{" "}
          <span className="font-semibold">portada</span> (n.º 1).
        </>
      ) : (
        <>
          <span className="font-semibold text-foreground">Orden:</span> flechas ← → o arrastra desde el asa{" "}
          <GripVertical className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden />.
        </>
      )}
    </p>
  );
}

export function ListaMiniaturasOrden({
  listaRef,
  arrastrando,
  className,
  children,
}: {
  listaRef: RefObject<HTMLUListElement | null>;
  arrastrando: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <ul
      ref={listaRef}
      data-arrastrando={arrastrando ? "true" : "false"}
      className={cn("galeria-orden-lista mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
    >
      {children}
    </ul>
  );
}

export function MiniaturaGaleriaOrden({
  idx,
  total,
  tipo,
  esPortada,
  resaltada,
  esOrigen,
  onPointerDown,
  onPortada,
  onMover,
  onQuitar,
  extraBadge,
  quitarClassName,
  children,
}: {
  idx: number;
  total: number;
  tipo: "foto" | "plano";
  esPortada: boolean;
  resaltada: boolean;
  esOrigen: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPortada?: () => void;
  onMover: (dir: -1 | 1) => void;
  onQuitar: () => void;
  extraBadge?: ReactNode;
  quitarClassName?: string;
  children: ReactNode;
}) {
  const puedeIzq = idx > 0;
  const puedeDer = idx < total - 1;
  const etiqueta = tipo === "foto" ? "foto" : "plano";

  return (
    <li
      data-orden-idx={idx}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("button") || t.closest(".galeria-orden-asas")) return;
        if (tipo === "foto" && !esPortada) onPortada?.();
      }}
      className={cn(
        "galeria-orden-celda group relative cursor-grab touch-none overflow-hidden rounded-[12px] border bg-[var(--surface-soft)] active:cursor-grabbing",
        resaltada && "galeria-orden-celda--objetivo border-accent",
        esOrigen && "galeria-orden-celda--origen",
        !resaltada && !esOrigen && "border-[var(--border)]"
      )}
    >
      {children}

      <span
        className="pointer-events-none absolute bottom-2 right-2 grid h-7 min-w-7 place-items-center rounded-full bg-black/65 px-1.5 text-[11px] font-bold tabular-nums text-white"
        aria-hidden
      >
        {idx + 1}
      </span>

      {extraBadge}

      {esPortada ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Portada
        </span>
      ) : tipo === "foto" ? (
        <span className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-4.5rem)] rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          Clic = portada
        </span>
      ) : null}

      <div className="galeria-orden-asas absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/65 via-black/40 to-transparent px-1.5 pb-1.5 pt-8">
        <button
          type="button"
          title="Mover a la izquierda (antes en el orden)"
          disabled={!puedeIzq}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (puedeIzq) onMover(-1);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/95 text-foreground shadow-sm disabled:opacity-35"
          aria-label={`Mover ${etiqueta} una posición antes`}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/85 text-[var(--text-2)] shadow-sm"
          title="Arrastra para reordenar"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </span>
        <button
          type="button"
          title="Mover a la derecha (después en el orden)"
          disabled={!puedeDer}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (puedeDer) onMover(1);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/95 text-foreground shadow-sm disabled:opacity-35"
          aria-label={`Mover ${etiqueta} una posición después`}
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onQuitar();
        }}
        className={cn(
          "absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white",
          quitarClassName
        )}
        aria-label={`Quitar ${etiqueta}`}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </li>
  );
}
